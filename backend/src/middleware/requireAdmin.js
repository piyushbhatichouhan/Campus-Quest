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
  const isAdmin =
    req.user.admin === true ||
    (req.user.claims && req.user.claims.admin === true);

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
