// frontend-app/src/lib/apollo-client.tsx
'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_GATEWAY_URL + '/graphql' || 'http://localhost:3000/graphql',
});

// --- Link untuk menambahkan JWT Token ke request GraphQL ---
const authLink = setContext((_, { headers }) => {
  // Ambil token dari local storage
  const token = localStorage.getItem('jwt-token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "", // Tambahkan header Authorization
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink), // Gabungkan authLink dengan httpLink
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}