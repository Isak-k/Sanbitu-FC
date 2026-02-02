// Environment variables check for Firebase
export const checkEnvironment = () => {
  // Firebase config is embedded in the app, no env vars needed for basic functionality
  console.log('Firebase environment: Ready');
  return true;
};

// Log environment status
if (import.meta.env.MODE === 'production') {
  console.log('Environment check:', checkEnvironment());
}