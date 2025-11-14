// services/graphql-api/server.js

// IMPOR LAMA ANDA 
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// IMPOR BARU UNTUK APOLLO v3 + SUBSCRIPTIONS 
const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws')


const app = express();
const pubsub = new PubSub();

// Enable CORS 
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// --- In-memory data store untuk Tasks ---
let tasks = [
  {
    id: '1',
    title: 'Selesaikan Laporan Keuangan',
    description: 'Laporan Q3 harus selesai akhir minggu ini.',
    status: 'IN_PROGRESS',
    authorId: '1', // ID User dari User Service
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Presentasi Marketing',
    description: 'Siapkan slide untuk meeting hari Senin.',
    status: 'TODO',
    authorId: '1',
    createdAt: new Date().toISOString(),
  }
];

// --- GraphQL type definitions (Skema Baru) ---
const typeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    DONE
  }

  type Task {
    id: ID!
    title: String!
    description: String!
    status: TaskStatus!
    authorId: ID!
    createdAt: String!
  }

  type Query {
    tasks: [Task!]!
    task(id: ID!): Task
  }

  type Mutation {
    createTask(title: String!, description: String!): Task!
    updateTaskStatus(id: ID!, status: TaskStatus!): Task!
  }

  type Subscription {
    taskUpdated: Task!
    taskAdded: Task!
  }
`;

// --- GraphQL resolvers (Resolvers Baru) ---
const resolvers = {
  Query: {
    // Dapatkan semua task (Di dunia nyata, filter berdasarkan authorId dari context)
    tasks: (parent, args, context) => {
      console.log('Fetching tasks for user:', context.userId);
      // Simpel: kembalikan semua task. Idealnya: tasks.filter(t => t.authorId === context.userId)
      return tasks;
    },
    task: (_, { id }) => tasks.find(task => task.id === id),
  },

  Mutation: {
    createTask: (_, { title, description }, context) => {
      // Dapatkan authorId dari context yang di-inject oleh gateway
      const { userId } = context;
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const newTask = {
        id: uuidv4(),
        title,
        description,
        status: 'TODO',
        authorId: userId, // Set authorId dari token JWT
        createdAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      pubsub.publish('TASK_ADDED', { taskAdded: newTask }); // Publikasi subscription
      return newTask;
    },

    updateTaskStatus: (_, { id, status }, context) => {
      const { userId } = context;
      if (!userId) {
        throw new Error('Not authenticated');
      }

      const taskIndex = tasks.findIndex(task => task.id === id);
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      // Idealnya cek apakah user ini boleh update task (task.authorId === userId)
      
      const updatedTask = {
        ...tasks[taskIndex],
        status,
      };
      
      tasks[taskIndex] = updatedTask;
      
      // Publikasi subscription
      pubsub.publish('TASK_UPDATED', { taskUpdated: updatedTask });
      
      return updatedTask;
    },
  },

  Subscription: {
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator(['TASK_UPDATED']),
    },
    taskAdded: {
      subscribe: () => pubsub.asyncIterator(['TASK_ADDED']),
    },
  },
};

// --- Setup Apollo Server (v3) ---
async function startServer() {
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      // --- INI PENTING ---
      // Ambil header yang di-forward oleh API Gateway
      const userId = req.headers['x-user-id'] || null;
      const userEmail = req.headers['x-user-email'] || null;
      const userRole = req.headers['x-user-role'] || null;

      console.log(`[GraphQL Context] User: ${userId} (${userEmail})`);

      // Return context yang akan tersedia di semua resolver
      return { userId, userEmail, userRole };
    },
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL API Server running on port ${PORT}`);
    console.log(`🔗 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`📡 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Process terminated');
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'graphql-api',
    timestamp: new Date().toISOString(),
    data: {
      tasks: tasks.length
    }
  });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});