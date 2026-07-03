function normalizeSessionEmail(req) {
  const email = req.session?.user?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function toPublicSessionUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || null,
  };
}

function setSessionUser(req, user) {
  const sessionUser = toPublicSessionUser(user);

  if (!sessionUser) {
    return null;
  }

  req.session.user = sessionUser;
  return sessionUser;
}

module.exports = {
  normalizeSessionEmail,
  setSessionUser,
  toPublicSessionUser,
};
