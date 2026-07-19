// Route registration — kept separate from the controller so the HTTP
// framework can be swapped without touching business logic.

export function registerRoutes(app, investmentController) {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/api/investment/projection", async (request, reply) => {
    try {
      return await investmentController.getProjection(request.query);
    } catch (error) {
      if (error && error.statusCode) {
        reply.code(error.statusCode);
        return { error: error.message };
      }
      request.log.error(error);
      reply.code(500);
      return { error: "Internal server error" };
    }
  });
}
