const { auth } = require("../config/firebase");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token required. Please log in.",
      },
    });
  }

  const token = authHeader.split("Bearer ")[1].trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token missing.",
      },
    });
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      name: decodedToken.name || decodedToken.displayName || "",
      admin: Boolean(decodedToken.admin),
      claims: decodedToken,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired session. Please log in again.",
      },
    });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1].trim();
    if (token) {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email || "",
          name: decodedToken.name || decodedToken.displayName || "",
          admin: Boolean(decodedToken.admin),
          claims: decodedToken,
        };
      } catch (err) {
        // Token invalid/expired - continue as unauthenticated
      }
    }
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
};
