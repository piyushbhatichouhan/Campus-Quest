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

  // Check if admin custom claim is set to true on the verified Firebase token
  // or if UID/email matches configured administrator environment variables
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const adminUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const isAdmin =
    req.user.admin === true ||
    (req.user.claims && req.user.claims.admin === true) ||
    (req.user.email && adminEmails.includes(req.user.email.toLowerCase())) ||
    (req.user.uid && adminUids.includes(req.user.uid));

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
};
