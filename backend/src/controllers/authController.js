import * as authService from '../services/authService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: result,
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

export const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body.idToken);

  res.status(200).json({
    success: true,
    message: 'Google login successful',
    data: result,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

export const logout = asyncHandler(async (_req, res) => {
  // Stateless JWT: client clears the token. Endpoint kept for API symmetry.
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
