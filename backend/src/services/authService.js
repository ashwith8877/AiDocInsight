import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import generateToken from '../utils/generateToken.js';
import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';

const googleClient = new OAuth2Client(env.googleClientId);

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  provider: user.provider,
  profilePicture: user.profilePicture || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const user = await User.create({ name, email, password, provider: 'local' });
  const token = generateToken(user._id);

  return {
    user: sanitizeUser(user),
    token,
  };
};

export const loginWithGoogle = async (idToken) => {
  if (!env.googleClientId) {
    throw ApiError.badRequest('Google sign-in is not configured.');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw ApiError.badRequest('Google ID token is required.');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Unable to verify Google sign-in.');
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw ApiError.unauthorized('Google account verification failed.');
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (user) {
    if (user.googleId && user.googleId !== payload.sub) {
      throw ApiError.unauthorized('This email is linked to another Google account.');
    }
    user.googleId = payload.sub;
    user.provider = user.provider === 'local' ? 'local' : 'google';
    if (!user.name && payload.name) user.name = payload.name;
    if (payload.picture) user.profilePicture = payload.picture;
    await user.save();
  } else {
    user = await User.create({
      name: payload.name || email.split('@')[0],
      email,
      googleId: payload.sub,
      profilePicture: payload.picture || null,
      provider: 'google',
    });
  }

  return { user: sanitizeUser(user), token: generateToken(user._id) };
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const token = generateToken(user._id);

  return {
    user: sanitizeUser(user),
    token,
  };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.');
  }
  return sanitizeUser(user);
};
