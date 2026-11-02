export const lovable = {
  auth: {
    signInWithOAuth: async () => ({
      error: new Error("Autenticação externa desativada no preview local."),
    }),
  },
};
