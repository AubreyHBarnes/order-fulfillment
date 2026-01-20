/**
 * Test Connection Screen
 * File: src/screens/TestConnectionScreen.tsx
 *
 * This screen tests the Appwrite connection by fetching products
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import { databases, config } from '../services/appwrite';
import type { Product } from '../types';

const TestConnectionScreen: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Testing...');

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      setConnectionStatus('Connecting to Appwrite...');

      // Try to fetch products from the database
      const response = await databases.listDocuments<Product>(
        config.databaseId,
        config.productsCollectionId
      );

      setProducts(response.documents);
      setConnectionStatus('Connected Successfully!');
      setLoading(false);
    } catch (err) {
      console.error('Connection error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setConnectionStatus('Connection Failed');
      setLoading(false);
    }
  };

  const renderProductItem = ({
    item,
  }: ListRenderItemInfo<Product>): React.ReactElement => (
    <View style={styles.productItem}>
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>${item.price}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Appwrite Connection Test</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>{connectionStatus}</Text>
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#0066cc"
          style={styles.loader}
        />
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Error:</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={testConnection}>
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>
            Found {products.length} products in database
          </Text>

          {products.length === 0 ? (
            <Text style={styles.noProducts}>
              No products yet. You can add them later!
            </Text>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.$id}
              renderItem={renderProductItem}
              style={styles.productList}
            />
          )}
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Configuration Check:</Text>
        <Text style={styles.infoText}>Appwrite SDK installed</Text>
        <Text style={styles.infoText}>Environment variables loaded</Text>
        <Text style={styles.infoText}>Database connection attempted</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loader: {
    marginTop: 20,
  },
  errorCard: {
    backgroundColor: '#ffebee',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#c62828',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    flex: 1,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2e7d32',
  },
  noProducts: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  productList: {
    flex: 1,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productName: {
    fontSize: 14,
    flex: 1,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
});

export default TestConnectionScreen;
