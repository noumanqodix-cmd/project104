// Authentication removed - returning default user
export function useAuth() {
  const user = {
    id: "default-user",
    name: "Default User",
    email: "user@example.com",
    // Add other default user properties as needed
  };

  return {
    user,
    isLoading: false,
    isAuthenticated: true, // Always authenticated since we removed auth
  };
}
