import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CardView } from '../components/CardView';
import { SupabaseCardRepository } from '../repositories/supabaseCardRepo';
import { InventoryItem, SavedDeck } from '../types/game';

interface DeckBuilderScreenProps {
  userId: string;
  sessionToken: string;
  repo: SupabaseCardRepository;
  onDeckSaved: (cardIds: string[]) => void;
  onActiveDeckUpdated?: (cardIds: string[]) => void;
  onBack: () => void;
}

export function DeckBuilderScreen({
  userId,
  sessionToken,
  repo,
  onDeckSaved,
  onActiveDeckUpdated,
  onBack,
}: DeckBuilderScreenProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('Baralho 1');
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const mapCardIdsToInventory = (
    cardIds: string[],
    poolSource: InventoryItem[]
  ): InventoryItem[] => {
    const pool = [...poolSource];
    const resolved: InventoryItem[] = [];

    for (const cardId of cardIds) {
      const foundIdx = pool.findIndex((item) => item.card.id === cardId);
      if (foundIdx !== -1) {
        resolved.push(pool[foundIdx]);
        pool.splice(foundIdx, 1);
      }
    }

    return resolved;
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [items, decks] = await Promise.all([
          repo.getUserInventory(userId),
          repo.getUserDecks(userId),
        ]);

        setInventory(items);
        setSavedDecks(decks);

        if (decks.length > 0) {
          const activeDeck = decks.find((d) => d.is_active) || decks[0];
          setEditingDeckId(activeDeck.id);
          setDeckName(activeDeck.name);
          setSelectedItems(mapCardIdsToInventory(activeDeck.card_ids, items));
        } else {
          setEditingDeckId(null);
          setDeckName('Baralho 1');
          setSelectedItems([]);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao carregar cartas e baralhos.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId, repo]);

  const handleSelectDeckTab = (deck: SavedDeck) => {
    setErrorMsg(null);
    setStatusMsg(null);
    setEditingDeckId(deck.id);
    setDeckName(deck.name);
    setSelectedItems(mapCardIdsToInventory(deck.card_ids, inventory));
  };

  const handleCreateNewDeck = () => {
    if (savedDecks.length >= 5) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setEditingDeckId(null);
    setDeckName(`Baralho ${savedDecks.length + 1}`);
    setSelectedItems([]);
  };

  const toggleCard = (item: InventoryItem) => {
    setStatusMsg(null);
    const alreadyInDeck = selectedItems.some(
      (s) => s.inventoryId === item.inventoryId
    );

    if (alreadyInDeck) {
      setSelectedItems(
        selectedItems.filter((s) => s.inventoryId !== item.inventoryId)
      );
    } else if (selectedItems.length < 5) {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleSave = async (equip: boolean) => {
    if (selectedItems.length !== 5) return;
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const cardIds = selectedItems.map((i) => i.card.id);
      const finalName = deckName.trim() || 'Baralho sem nome';
      const savedId = await repo.saveDeck(
        sessionToken,
        editingDeckId,
        finalName,
        cardIds,
        equip
      );

      if (equip) {
        onDeckSaved(cardIds);
        return;
      }

      // Refresh deck list in place without equipping
      const updatedDecks = await repo.getUserDecks(userId);
      setSavedDecks(updatedDecks);
      setEditingDeckId(savedId);
      setStatusMsg('Baralho salvo!');

      const currentActive = updatedDecks.find((d) => d.is_active);
      if (currentActive && onActiveDeckUpdated) {
        onActiveDeckUpdated(currentActive.card_ids);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar baralho.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const isCreatingNew = editingDeckId === null;
  const isComplete = selectedItems.length === 5;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Baralhos ({savedDecks.length}/5)
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Saved Decks Horizontal Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {savedDecks.map((deck) => {
            const isSelectedTab = deck.id === editingDeckId;
            return (
              <TouchableOpacity
                key={deck.id}
                style={[styles.deckTab, isSelectedTab && styles.deckTabActive]}
                onPress={() => handleSelectDeckTab(deck)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.deckTabText,
                    isSelectedTab && styles.deckTabTextActive,
                  ]}
                >
                  {deck.name} {deck.is_active ? '★' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {savedDecks.length < 5 && (
            <TouchableOpacity
              style={[styles.newDeckTab, isCreatingNew && styles.deckTabActive]}
              onPress={handleCreateNewDeck}
            >
              <Text style={styles.newDeckTabText}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Deck Name Input */}
      <TextInput
        style={styles.nameInput}
        placeholder="Nome do baralho"
        placeholderTextColor="#64748b"
        maxLength={24}
        value={deckName}
        onChangeText={(text) => {
          setStatusMsg(null);
          setDeckName(text);
        }}
      />

      {/* Active 5-Card Slots */}
      <View style={styles.deckRow}>
        {Array.from({ length: 5 }).map((_, idx) => {
          const item = selectedItems[idx];
          return (
            <TouchableOpacity
              key={idx}
              style={styles.deckSlot}
              disabled={!item}
              onPress={() => item && toggleCard(item)}
            >
              {item ? (
                <CardView card={item.card} owner="BLUE" compact />
              ) : (
                <Text style={styles.slotPlaceholder}>+</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      {statusMsg && <Text style={styles.successText}>{statusMsg}</Text>}

      {/* User Inventory Grid */}
      <Text style={styles.sectionTitle}>
        Sua Biblioteca ({inventory.length} cartas) • {selectedItems.length}/5
      </Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {inventory.map((item) => {
          const isSelected = selectedItems.some(
            (s) => s.inventoryId === item.inventoryId
          );
          return (
            <TouchableOpacity
              key={item.inventoryId}
              style={[styles.gridItem, isSelected && styles.gridItemUsed]}
              onPress={() => toggleCard(item)}
            >
              <CardView
                card={item.card}
                owner="BLUE"
                isSelected={isSelected}
                compact
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Save Only & Save + Equip Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.saveOnlyButton,
            (!isComplete || saving) && styles.buttonDisabled,
          ]}
          disabled={!isComplete || saving}
          onPress={() => handleSave(false)}
        >
          <Text style={styles.actionButtonText}>
            {saving ? '...' : 'Salvar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.equipButton,
            (!isComplete || saving) && styles.buttonDisabled,
          ]}
          disabled={!isComplete || saving}
          onPress={() => handleSave(true)}
        >
          <Text style={styles.actionButtonText}>
            {saving
              ? 'Salvando...'
              : isComplete
              ? 'Salvar e Equipar'
              : `Faltam ${5 - selectedItems.length} carta(s)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 40,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  backText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
  },
  tabsWrapper: {
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  deckTab: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 130,
  },
  deckTabActive: {
    borderColor: '#facc15',
    backgroundColor: '#1e3a8a',
  },
  deckTabText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  deckTabTextActive: {
    color: '#ffffff',
  },
  newDeckTab: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  newDeckTabText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '800',
  },
  nameInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  deckRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 88,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deckSlot: {
    width: '18.5%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotPlaceholder: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  successText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 20,
  },
  gridItem: {
    width: '31.5%',
    height: 94,
  },
  gridItemUsed: {
    opacity: 0.45,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveOnlyButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  equipButton: {
    flex: 1.6,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#334155',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});