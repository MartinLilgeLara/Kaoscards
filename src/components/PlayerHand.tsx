import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardData, PlayerColor } from '../types/game';
import { CardView } from './CardView';

interface PlayerHandProps {
  player: PlayerColor;
  playerName?: string;
  cards: CardData[];
  isActiveTurn: boolean;
  canInteract: boolean;
  hideCards?: boolean;
  selectedIndex: number | null;
  onSelectCard: (index: number) => void;
}

export function PlayerHand({
  player,
  playerName,
  cards,
  isActiveTurn,
  canInteract,
  hideCards = false,
  selectedIndex,
  onSelectCard,
}: PlayerHandProps) {
  const defaultLabel = player === 'BLUE' ? 'Azul' : 'Vermelho';
  const displayName = playerName || defaultLabel;

  return (
    <View style={[styles.container, !isActiveTurn && styles.inactiveContainer]}>
      <Text style={styles.label}>
        {displayName} {isActiveTurn ? '(Jogando)' : ''}
      </Text>

      <View style={styles.cardsRow}>
        {cards.map((card, index) => {
          const isSelected = canInteract && selectedIndex === index;

          return (
            <TouchableOpacity
              key={`${card.id}-${index}`}
              activeOpacity={0.8}
              disabled={!canInteract}
              onPress={() => onSelectCard(index)}
              style={[
                styles.cardWrapper,
                isSelected && styles.cardWrapperSelected,
              ]}
            >
              <CardView
                card={card}
                owner={player}
                isSelected={isSelected}
                faceDown={hideCards}
                compact
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inactiveContainer: {
    opacity: 0.45,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    height: 86,
  },
  cardWrapper: {
    width: '18.5%',
    height: '100%',
  },
  cardWrapperSelected: {
    transform: [{ translateY: -8 }],
  },
});
