/**
 * Product Image Component
 * File: src/components/common/ProductImage.tsx
 *
 * PURPOSE:
 * Square product photo with an "i" badge in the lower-right corner. Tapping
 * the badge opens a small popup crediting the photographer and Unsplash, as
 * Unsplash's API guidelines require for hotlinked photos. Products without a
 * photo fall back to a neutral placeholder.
 *
 * Images are hotlinked from images.unsplash.com (their guidelines forbid
 * re-hosting); the size/crop params are appended here so the same stored URL
 * serves any card size.
 *
 * Same Modal + Pressable-backdrop pattern as NewAssignmentModal.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Image, Modal, Pressable, Linking } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../theme';
import type { Product } from '../../types';

const UNSPLASH_URL = 'https://unsplash.com/?utm_source=GroceryFulfillmentApp&utm_medium=referral';

interface ProductImageProps {
  product: Product;
  size: number;
}

const ProductImage: React.FC<ProductImageProps> = ({ product, size }) => {
  const theme = useAppTheme();
  const [creditVisible, setCreditVisible] = useState(false);

  const hasCredit = !!product.imageURL && !!product.imagePhotographer;
  // Request 2x the display size so the photo stays sharp on dense screens
  const uri = product.imageURL
    ? `${product.imageURL}${product.imageURL.includes('?') ? '&' : '?'}w=${size * 2}&h=${size * 2}&fit=crop&q=75`
    : undefined;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={product.name}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon source="basket-outline" size={size / 3} color={theme.custom.textDisabled} />
        </View>
      )}

      {hasCredit && (
        <Pressable
          onPress={() => setCreditVisible(true)}
          style={styles.infoBadge}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Photo credit"
        >
          <Icon source="information-variant" size={16} color="#FFFFFF" />
        </Pressable>
      )}

      <Modal
        visible={creditVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreditVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreditVisible(false)}>
          {/* Own Pressable so taps on the card don't dismiss via the backdrop */}
          <Pressable
            onPress={() => {}}
            style={[styles.creditCard, { backgroundColor: theme.colors.surface }]}
          >
            <Text variant="titleMedium" style={[styles.creditTitle, { color: theme.colors.onSurface }]}>
              Photo credit
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.custom.textSecondary }}>
              Photo by{' '}
              <Text
                style={{ color: theme.colors.primary }}
                onPress={() =>
                  product.imagePhotographerUrl && Linking.openURL(product.imagePhotographerUrl)
                }
              >
                {product.imagePhotographer}
              </Text>{' '}
              on{' '}
              <Text style={{ color: theme.colors.primary }} onPress={() => Linking.openURL(UNSPLASH_URL)}>
                Unsplash
              </Text>
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  creditCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    elevation: 8,
  },
  creditTitle: {
    fontWeight: '700',
    marginBottom: 8,
  },
});

export default ProductImage;
