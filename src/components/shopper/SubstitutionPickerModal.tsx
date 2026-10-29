/**
 * Substitution Picker Modal Component
 * File: src/components/shopper/SubstitutionPickerModal.tsx
 *
 * PURPOSE:
 * Lets a shopper search for and pick a replacement product when the
 * originally ordered item is unavailable. Opened from ItemChecklistItem's
 * "Substitute" button on ShoppingScreen.
 *
 * Follows the same Modal + Pressable-backdrop pattern already used three
 * times in this codebase (NewAssignmentModal, OrderInterruptedModal,
 * ShopperStatusDropdown) - the content is wrapped in its own no-op
 * Pressable so taps on it don't fall through to the backdrop's dismiss.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList } from 'react-native';
import { Text, Searchbar, ActivityIndicator, IconButton } from 'react-native-paper';
import { useAppTheme, fontFamilies, spacing, tabularNums } from '../../theme';
import { searchProducts, formatPrice } from '../../services/productService';
import type { SubstitutionPickerModalProps, Product } from '../../types';

const SubstitutionPickerModal: React.FC<SubstitutionPickerModalProps> = ({
  visible,
  originalProduct,
  onSelect,
  onCancel,
}) => {
  const theme = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const dynamicStyles = {
    modalOverlay: {
      backgroundColor: theme.custom.scrim,
    },
    card: {
      backgroundColor: theme.colors.elevation.level3,
    },
    title: {
      color: theme.colors.onSurface,
    },
    subtitle: {
      color: theme.custom.textSecondary,
    },
    resultName: {
      color: theme.colors.onSurface,
    },
    resultPrice: {
      ...tabularNums,
      color: theme.colors.primary,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
  };

  const handleSearch = async (text: string): Promise<void> => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const result = await searchProducts(text);
    setResults(result.success ? result.data : []);
    setLoading(false);
  };

  const handleClose = (): void => {
    setQuery('');
    setResults([]);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={handleClose}>
      <Pressable style={[styles.modalOverlay, dynamicStyles.modalOverlay]} onPress={handleClose}>
        <Pressable onPress={() => {}} style={[styles.card, dynamicStyles.card]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="titleLarge" style={[styles.title, dynamicStyles.title]}>
                Find a Substitute
              </Text>
              {originalProduct && (
                <Text variant="bodyMedium" style={[styles.subtitle, dynamicStyles.subtitle]}>
                  Replacing {originalProduct.name}
                </Text>
              )}
            </View>
            <IconButton icon="close" onPress={handleClose} />
          </View>

          <Searchbar
            placeholder="Search products..."
            value={query}
            onChangeText={handleSearch}
            style={styles.searchBar}
          />

          {loading && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loading} />
          )}

          <FlatList
            data={results}
            keyExtractor={(item) => item.$id}
            style={styles.list}
            ListEmptyComponent={
              !loading && query.trim() !== '' ? (
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No products found</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
              >
                <View style={styles.resultRow}>
                  <Text variant="bodyLarge" style={dynamicStyles.resultName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text variant="bodyMedium" style={dynamicStyles.resultPrice}>
                    {formatPrice(item.price)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.heading,
  },
  subtitle: {
    marginTop: spacing.xxs,
  },
  searchBar: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  loading: {
    marginVertical: spacing.sm,
  },
  list: {
    marginTop: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});

export default SubstitutionPickerModal;
