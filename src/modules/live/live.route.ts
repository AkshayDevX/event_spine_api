import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { subClient, getWorkflowChannel } from "../queue/pubsub";

const liveRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Params: { workflowId: string }; Querystring: { token: string } }>(
    "/workflows/:workflowId",
    { websocket: true },
    (socket, req) => {
      const { workflowId } = req.params;
      const { token } = req.query;

      if (!token) {
        socket.send(JSON.stringify({ error: "Missing token query parameter" }));
        socket.close();
        return;
      }

      // Authenticate the connection manually since standard hooks don't easily apply to websocket handshake in fastify
      try {
        const decoded = app.jwt.verify(token);
        if (!decoded) throw new Error("Invalid token");
      } catch {
        socket.send(JSON.stringify({ error: "Unauthorized" }));
        socket.close();
        return;
      }

      const channel = getWorkflowChannel(workflowId);
      
      // Redis message listener specific to this connection
      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          socket.send(message);
        }
      };

      // Subscribe and attach listener
      subClient.subscribe(channel, (err) => {
        if (err) {
          req.log.error(`Failed to subscribe to ${channel}: ${err.message}`);
        } else {
          req.log.info(`WebSocket subscribed to ${channel}`);
        }
      });
      subClient.on("message", messageHandler);

      // Handle client disconnect
      socket.on("close", () => {
        req.log.info(`WebSocket disconnected from ${channel}`);
        // Remove this specific listener to prevent memory leaks
        subClient.off("message", messageHandler);
        
        // We only unsubscribe from the channel if there are no more listeners for it, 
        // but ioredis handles multiple subscriptions to the same channel gracefully (it's global per client).
        // However, we should unsubscribe if we are managing subscription counts, but for simplicity we just remove the event listener.
        // If we want to fully unsubscribe when the last client disconnects, we'd need a connection counter.
      });

      // Handle incoming messages from the client if any (ping/pong etc.)
      socket.on("message", (msg: unknown) => {
        // We generally don't expect the client to send messages, but we can log or ignore
        req.log.debug(`Received message from live websocket client: ${msg}`);
      });
    },
  );
};

export default liveRoutes;
