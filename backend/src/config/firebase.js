const {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
} = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

class MockTimestamp {
  constructor(date = new Date()) {
    this._date = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  }
  toDate() {
    return new Date(this._date.getTime());
  }
  toMillis() {
    return this._date.getTime();
  }
  toISOString() {
    return this._date.toISOString();
  }
  valueOf() {
    return this._date.getTime();
  }
}

const SERVER_TIMESTAMP_SENTINEL = { __isServerTimestamp: true };

function isServerTimestampValue(val) {
  if (!val || typeof val !== "object") return false;
  if (val.__isServerTimestamp) return true;
  const ctorName = val.constructor ? val.constructor.name : "";
  return ctorName === "ServerTimestampTransform" || ctorName === "FieldValue";
}

function cloneAndResolveValue(val, now) {
  if (val === undefined) return undefined;
  if (val === null || typeof val !== "object") return val;
  if (isServerTimestampValue(val)) {
    return new MockTimestamp(now);
  }
  if (val instanceof MockTimestamp) {
    return new MockTimestamp(val.toDate());
  }
  if (val instanceof Date) {
    return new MockTimestamp(val);
  }
  if (Array.isArray(val)) {
    return val.map((item) => cloneAndResolveValue(item, now));
  }
  const result = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      result[k] = cloneAndResolveValue(v, now);
    }
  }
  return result;
}

function createInMemoryFirestore() {
  // Map of full document path -> { data: Object, version: number }
  const store = new Map();
  let autoIdCounter = 1;

  function generateAutoId() {
    return `mock_doc_${Date.now()}_${autoIdCounter++}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getEntry(path) {
    return store.get(path) || null;
  }

  function makeDocSnapshot(id, path, entry) {
    const exists = Boolean(entry && entry.data);
    const clonedData = exists ? cloneAndResolveValue(entry.data, new Date()) : undefined;
    return {
      id,
      ref: makeDocRef(path),
      exists,
      data() {
        return exists ? cloneAndResolveValue(clonedData, new Date()) : undefined;
      },
    };
  }

  function applySet(path, data, options = {}) {
    const now = new Date();
    const resolved = cloneAndResolveValue(data, now);
    const existing = store.get(path);
    const nextVersion = existing ? existing.version + 1 : 1;

    if (options && options.merge && existing && existing.data) {
      store.set(path, {
        data: { ...cloneAndResolveValue(existing.data, now), ...resolved },
        version: nextVersion,
      });
    } else {
      store.set(path, {
        data: resolved,
        version: nextVersion,
      });
    }
  }

  function applyUpdate(path, updates) {
    const existing = store.get(path);
    if (!existing || !existing.data) {
      throw new Error(`NOT_FOUND: No document to update at ${path}`);
    }
    const now = new Date();
    const resolved = cloneAndResolveValue(updates, now);
    store.set(path, {
      data: { ...cloneAndResolveValue(existing.data, now), ...resolved },
      version: existing.version + 1,
    });
  }

  function applyDelete(path) {
    const existing = store.get(path);
    const nextVersion = existing ? existing.version + 1 : 1;
    store.set(path, { data: null, version: nextVersion });
  }

  function makeDocRef(path) {
    const segments = path.split("/");
    const id = segments[segments.length - 1];
    return {
      id,
      path,
      async get() {
        const entry = getEntry(path);
        return makeDocSnapshot(id, path, entry);
      },
      async set(data, options = {}) {
        applySet(path, data, options);
      },
      async update(updates) {
        applyUpdate(path, updates);
      },
      async delete() {
        applyDelete(path);
      },
      collection(subName) {
        return makeCollectionRef(`${path}/${subName}`);
      },
    };
  }

  function toComparableValue(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val.toMillis === "function") return val.toMillis();
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number" || typeof val === "string") return val;
    return String(val);
  }

  function makeQuery(collectionPath, filters = [], orderBys = [], limitCount = null) {
    return {
      where(field, op, value) {
        return makeQuery(
          collectionPath,
          [...filters, { field, op, value }],
          orderBys,
          limitCount,
        );
      },
      orderBy(field, direction = "asc") {
        return makeQuery(
          collectionPath,
          filters,
          [...orderBys, { field, direction }],
          limitCount,
        );
      },
      limit(n) {
        return makeQuery(collectionPath, filters, orderBys, n);
      },
      async get() {
        const prefix = `${collectionPath}/`;
        const docs = [];

        for (const [key, entry] of store.entries()) {
          if (!entry || !entry.data) continue;
          if (!key.startsWith(prefix)) continue;
          const remainder = key.slice(prefix.length);
          if (remainder.includes("/")) continue; // Direct children only

          docs.push(makeDocSnapshot(remainder, key, entry));
        }

        let filtered = docs.filter((snap) => {
          const d = snap.data();
          return filters.every(({ field, op, value }) => {
            const fieldVal = toComparableValue(d[field]);
            const targetVal = toComparableValue(value);
            if (op === "==") return fieldVal === targetVal;
            if (op === ">") return fieldVal > targetVal;
            if (op === ">=") return fieldVal >= targetVal;
            if (op === "<") return fieldVal < targetVal;
            if (op === "<=") return fieldVal <= targetVal;
            if (op === "!=") return fieldVal !== targetVal;
            return true;
          });
        });

        if (orderBys.length > 0) {
          filtered.sort((a, b) => {
            const aData = a.data();
            const bData = b.data();
            for (const { field, direction } of orderBys) {
              const va = toComparableValue(aData[field]);
              const vb = toComparableValue(bData[field]);
              if (va < vb) return direction === "desc" ? 1 : -1;
              if (va > vb) return direction === "desc" ? -1 : 1;
            }
            return 0;
          });
        }

        if (typeof limitCount === "number" && limitCount >= 0) {
          filtered = filtered.slice(0, limitCount);
        }

        return {
          docs: filtered,
          size: filtered.length,
          empty: filtered.length === 0,
        };
      },
    };
  }

  function makeCollectionRef(collectionPath) {
    const baseQuery = makeQuery(collectionPath);
    return {
      path: collectionPath,
      doc(docId) {
        const resolvedId = docId || generateAutoId();
        return makeDocRef(`${collectionPath}/${resolvedId}`);
      },
      where: baseQuery.where,
      orderBy: baseQuery.orderBy,
      limit: baseQuery.limit,
      get: baseQuery.get,
    };
  }

  async function runTransaction(updateFunction) {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const readVersions = new Map();
      const stagedOps = new Map(); // path -> { type: 'set'|'update'|'delete', data, options }

      const tx = {
        async get(docRef) {
          const path = docRef.path;
          if (!readVersions.has(path)) {
            const currentEntry = getEntry(path);
            readVersions.set(path, currentEntry ? currentEntry.version : 0);
          }

          if (stagedOps.has(path)) {
            const op = stagedOps.get(path);
            if (op.type === "delete") {
              return makeDocSnapshot(docRef.id, path, null);
            }
            return makeDocSnapshot(docRef.id, path, { data: op.data, version: 1 });
          }

          const entry = getEntry(path);
          return makeDocSnapshot(docRef.id, path, entry);
        },
        set(docRef, data, options = {}) {
          const path = docRef.path;
          const existing = stagedOps.has(path)
            ? stagedOps.get(path).data
            : getEntry(path)?.data;
          const merged =
            options && options.merge && existing
              ? { ...existing, ...data }
              : data;
          stagedOps.set(path, { type: "set", data: merged, options });
          return tx;
        },
        update(docRef, updates) {
          const path = docRef.path;
          const existing = stagedOps.has(path)
            ? stagedOps.get(path).data
            : getEntry(path)?.data;
          if (!existing) {
            throw new Error(`NOT_FOUND: No document to update at ${path}`);
          }
          stagedOps.set(path, {
            type: "update",
            data: { ...existing, ...updates },
            updates,
          });
          return tx;
        },
        delete(docRef) {
          stagedOps.set(docRef.path, { type: "delete" });
          return tx;
        },
      };

      const result = await updateFunction(tx);

      // Optimistic concurrency check: verify no read document changed while transaction executed
      let conflict = false;
      for (const [path, recordedVersion] of readVersions.entries()) {
        const currentEntry = getEntry(path);
        const currentVersion = currentEntry ? currentEntry.version : 0;
        if (currentVersion !== recordedVersion) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        if (attempt === maxAttempts) {
          throw new Error("Transaction aborted due to concurrent modification conflict.");
        }
        continue;
      }

      // Commit staged operations atomically
      for (const [path, op] of stagedOps.entries()) {
        if (op.type === "set") {
          applySet(path, op.data, op.options);
        } else if (op.type === "update") {
          applyUpdate(path, op.updates);
        } else if (op.type === "delete") {
          applyDelete(path);
        }
      }

      return result;
    }
  }

  return {
    collection(name) {
      return makeCollectionRef(name);
    },
    runTransaction,
    _reset() {
      store.clear();
    },
  };
}

function createMockAuth(realAuth = null) {
  return {
    async verifyIdToken(token) {
      // Allow structured test tokens during automated testing
      if (
        (process.env.NODE_ENV === "test" || process.env.USE_IN_MEMORY_DB === "true" || !realAuth) &&
        typeof token === "string" &&
        token.startsWith("test-token:")
      ) {
        const payloadStr = token.slice("test-token:".length);
        try {
          const parsed = JSON.parse(payloadStr);
          return {
            uid: parsed.uid || "test_uid",
            email: parsed.email || "",
            name: parsed.name || parsed.displayName || "Test User",
            admin: Boolean(parsed.admin),
            ...parsed,
          };
        } catch {
          const [uid, email, role] = payloadStr.split(":");
          return {
            uid: uid || "test_uid",
            email: email || "",
            name: uid || "Test User",
            admin: role === "admin",
          };
        }
      }

      if (realAuth) {
        return realAuth.verifyIdToken(token);
      }

      throw new Error("Invalid or expired authentication token.");
    },
  };
}

function hasExplicitFirebaseCredentials() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIRESTORE_EMULATOR_HOST,
  );
}

function resolveCredential() {
  // Option 1: Render Secret Environment Variable (Full JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed =
        typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === "string"
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim())
          : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (!parsed.client_email || !parsed.private_key) {
        throw new Error(
          "Service account JSON must contain client_email and private_key.",
        );
      }

      if (
        typeof parsed.private_key === "string" &&
        parsed.private_key.includes("\\n")
      ) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      return cert(parsed);
    } catch (err) {
      console.error(
        "[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        err.message,
      );
      throw err;
    }
  }

  // Option 2: Individual environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  // Option 3: Local file via GOOGLE_APPLICATION_CREDENTIALS or Google Cloud ADC
  return applicationDefault();
}

const isNodeTestRunner =
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.execArgv.includes("--test") ||
  process.argv.includes("--test");

const useInMemory =
  isNodeTestRunner ||
  process.env.NODE_ENV === "test" ||
  process.env.USE_IN_MEMORY_DB === "true" ||
  !hasExplicitFirebaseCredentials();

let db;
let auth;

if (!useInMemory) {
  if (getApps().length === 0) {
    try {
      const credential = resolveCredential();
      const config = { credential };
      if (process.env.FIREBASE_PROJECT_ID) {
        config.projectId = process.env.FIREBASE_PROJECT_ID;
      }
      initializeApp(config);
    } catch (error) {
      console.error("[Firebase Admin] Initialization error:", error.message);
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
    }
  }
  db = getFirestore();
  auth = createMockAuth(getAuth());
} else {
  db = createInMemoryFirestore();
  auth = createMockAuth(null);
}

const serverTimestamp = () =>
  useInMemory ? SERVER_TIMESTAMP_SENTINEL : FieldValue.serverTimestamp();

module.exports = {
  db,
  auth,
  FieldValue,
  serverTimestamp,
  isInMemoryMode: useInMemory,
};
