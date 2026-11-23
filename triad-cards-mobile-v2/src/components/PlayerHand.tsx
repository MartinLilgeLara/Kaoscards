import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CardData, PlayerColor } from '../types/game';
import { CardView } from './CardView';

interface PlayerHandProps {
  player: PlayerColor;
  cards: CardData[];
  isActiveTurn: boolean;
  selectedIndex: number | null;
  onSelectCard: (index: number) => void;
}

export function PlayerHand({
  player,
  cards,
  isActiveTurn,
  selectedIndex,
  onSelectCard,
}: PlayerHandProps) {
  const label = player === 'BLUE' ? 'Jogador Azul' : 'Jogador Vermelho';

  return (
    <View style={[styles.container, !isActiveTurn && styles.inactiveContainer]}>
      <Text style={styles.label}>
        {label} {isActiveTurn ? '(Sua vez)' : ''}
      </Text>

      <View style={styles.cardsRow}>
        {cards.map((card, index) => {
          const isSelected = isActiveTurn && selectedIndex === index;

          return (
            <TouchableOpacity
              key={`${card.id}-${index}`}
              activeOpacity={0.8}
              disabled={!isActiveTurn}
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
