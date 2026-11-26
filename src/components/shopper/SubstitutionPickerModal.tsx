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
 *
 * SEARCH-AS-YOU-TYPE: TWO SAFEGUARDS (see handleSearch below)
 * 1. DEBOUNCE - wait until the shopper pauses typing before searching, so
 *    "lettuce" sends one request instead of seven.
 * 2. STALE-RESPONSE GUARD - even with a debounce, a slow early request can
 *    land after a newer one, so every response checks it is still the
 *    latest before touching state.
 * A debounce reduces how often the race can happen; only the guard makes
 * it impossible. Use both.
 */

// How long the shopper must stop typing before we search. 300 ms is the
// usual default: short enough to feel instant, long enough to skip the
// keystrokes in the middle of a word.
const SEARCH_DEBOUNCE_MS = 300;

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, FlatList } from 'react-native';
import { Text, Searchbar, ActivityIndicator, IconButton } from 'react-native-paper';
import { useAppTheme } from '../../theme';
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

  // WHY REFS AND NOT STATE FOR THESE TWO?
  // Neither value is ever shown on screen, and changing them must not
  // re-render the modal. A ref is a mutable box that survives re-renders
  // without triggering one - the right tool for "bookkeeping" values.
  // Also, a ref always holds the CURRENT value, even inside an async
  // callback that was created earlier (state read from such a callback
  // would be a stale snapshot from when the callback was created).
  //
  // latestQuery: the most recent text typed - what a response is compared
  // against to decide if it is stale.
  // debounceTimer: the pending "search in 300 ms" timer, so the next
  // keystroke can cancel it.
  const latestQuery = useRef('');
  // Starts at 0 because timer ids are positive numbers and clearTimeout(0)
  // is a harmless no-op - that lets us call clearTimeout unconditionally
  // below instead of sprinkling "if (timer)" checks everywhere.
  const debounceTimer = useRef(0);

  // Cancel any pending timer if the component unmounts, so it can't fire
  // later and call setState on a component that no longer exists. The
  // function returned from an effect is React's cleanup hook for this.
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  const dynamicStyles = {
    modalOverlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    card: {
      backgroundColor: theme.colors.surface,
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
      color: theme.colors.primary,
    },
    emptyText: {
      color: theme.custom.textSecondary,
    },
  };

  const handleSearch = (text: string): void => {
    // Always update the visible text immediately - only the SEARCH is
    // delayed, never the typing, or the input would feel laggy.
    setQuery(text);
    latestQuery.current = text;

    // A new keystroke makes any not-yet-fired search obsolete. Clearing an
    // already-fired or empty (0) timer is harmless, so no "is it set?" check.
    clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      // Empty box: nothing to search, so also drop any spinner left over
      // from a search that is no longer wanted.
      setResults([]);
      setLoading(false);
      return;
    }

    // Show the spinner right away so the shopper knows something is coming
    // during the 300 ms wait, not only once the request starts.
    setLoading(true);

    debounceTimer.current = setTimeout(async () => {
      const result = await searchProducts(text);

      // STALE-RESPONSE GUARD. While this request was in flight the shopper
      // may have typed more (or closed the modal). Networks don't promise
      // responses arrive in the order they were sent, so an old answer can
      // arrive last and overwrite the right one. If the text has moved on,
      // throw this result away. We also skip setLoading(false): the newer
      // search owns the spinner now.
      if (latestQuery.current !== text) {
        return;
      }

      // the item being replaced can't substitute for itself
      setResults(result.success ? result.data.filter((p) => p.$id !== originalProduct?.$id) : []);
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClose = (): void => {
    // Cancel a pending search AND invalidate any in-flight one: resetting
    // latestQuery to '' means no outstanding response can match it, so a
    // late reply can't repopulate the list after the modal was closed.
    clearTimeout(debounceTimer.current);
    latestQuery.current = '';
    setQuery('');
    setResults([]);
    setLoading(false);
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
            // Three states, not two: searching (spinner above, show nothing
            // here), no results for a real query, and "haven't searched
            // yet" - the last one gets a hint so the blank box isn't a
            // dead end.
            ListEmptyComponent={
              loading ? null : query.trim() !== '' ? (
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No products found</Text>
              ) : (
                <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                  {originalProduct
                    ? `Search for a replacement for ${originalProduct.name}`
                    : 'Search for a replacement product'}
                </Text>
              )
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
    padding: 20,
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
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
  },
  searchBar: {
    marginTop: 8,
    marginBottom: 8,
  },
  loading: {
    marginVertical: 8,
  },
  list: {
    marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
  },
});

export default SubstitutionPickerModal;
