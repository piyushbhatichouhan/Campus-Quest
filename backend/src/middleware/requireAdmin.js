const { db } = require("../config/firebase");

async function checkIsAdminUser(user) {
  if (!user || !user.uid) return false;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const adminUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const directMatch =
    user.admin === true ||
    (user.claims && user.claims.admin === true) ||
    (user.email && adminEmails.includes(user.email.toLowerCase())) ||
    (user.uid && adminUids.includes(user.uid));

  if (directMatch) return true;

  try {
    const [adminDoc, playerDoc] = await Promise.all([
      db.collection("admins").doc(user.uid).get(),
      db.collection("players").doc(user.uid).get(),
    ]);
    if (adminDoc.exists && adminDoc.data()?.active !== false) {
      return true;
    }
    if (
      playerDoc.exists &&
      (playerDoc.data()?.isAdmin === true || playerDoc.data()?.role === "admin")
    ) {
      return true;
    }
  } catch {
    // Ignore DB lookup errors and fall through to false
  }

  return false;
}

async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const isAdmin = await checkIsAdminUser(req.user);

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Administrator access required.",
      },
    });
  }

  next();
}

module.exports = {
  requireAdmin,
  checkIsAdminUser,
};
