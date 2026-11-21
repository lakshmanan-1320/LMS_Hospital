
import { apiClient } from '@/lib/axios';

const USERS_ENDPOINT = '/users';

export const userService = {
  // Get users with search, filters and pagination
  async getUsers({
    search = '',
    role = '',
    status = '',
    page = 1,
    limit = 10,
  } = {}) {
    const response = await apiClient.get(USERS_ENDPOINT, {
      params: {
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        limit,
      },
    });

    return response;
  },

  // Get one user's details
  async getUserById(userId) {
    return apiClient.get(`${USERS_ENDPOINT}/${userId}`);
  },

  // Create a user
  async createUser(userData) {
    return apiClient.post(USERS_ENDPOINT, userData);
  },

  // Update user details
  async updateUser(userId, userData) {
    return apiClient.patch(`${USERS_ENDPOINT}/${userId}`, userData);
  },

  // Activate or deactivate a user
  async updateUserStatus(userId, isActive) {
    return apiClient.patch(`${USERS_ENDPOINT}/${userId}/status`, {
      isActive,
    });
  },

  // Soft-delete a user
  async deleteUser(userId) {
    return apiClient.delete(`${USERS_ENDPOINT}/${userId}`);
  },
};

export default userService;
