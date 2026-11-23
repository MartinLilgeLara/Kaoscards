import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardData, PlayerColor } from '../types/game';

interface CardViewProps {
  card: CardData;
  owner: PlayerColor;
  isSelected?: boolean;
  compact?: boolean;
}

export function CardView({
  card,
  owner,
  isSelected = false,
  compact = false,
}: CardViewProps) {
  const backgroundColor = owner === 'BLUE' ? '#1d4ed8' : '#b91c1c';
  const borderColor = isSelected ? '#facc15' : owner === 'BLUE' ? '#60a5fa' : '#f87171';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          borderWidth: isSelected ? 3 : 1.5,
        },
      ]}
    >
      <Text style={[styles.statText, compact && styles.statCompact]}>
        {card.stats.north}
      </Text>

      <View style={styles.middleRow}>
        <Text style={[styles.statText, compact && styles.statCompact]}>
          {card.stats.west}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.cardName, compact && styles.nameCompact]}
        >
          {card.name}
        </Text>
        <Text style={[styles.statText, compact && styles.statCompact]}>
          {card.stats.east}
        </Text>
      </View>

      <Text style={[styles.statText, compact && styles.statCompact]}>
        {card.stats.south}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  middleRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  statCompact: {
    fontSize: 13,
  },
  cardName: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '600',
    maxWidth: '58%',
    textAlign: 'center',
  },
  nameCompact: {
    fontSize: 8,
  },
});
