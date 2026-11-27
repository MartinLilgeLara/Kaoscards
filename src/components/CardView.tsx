import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CardData, PlayerColor } from '../types/game';

interface CardViewProps {
  card: CardData;
  owner: PlayerColor;
  isSelected?: boolean;
  compact?: boolean;
  faceDown?: boolean;
}

export function CardView({
  card,
  owner,
  isSelected = false,
  compact = false,
  faceDown = false,
}: CardViewProps) {
  const backgroundColor = owner === 'BLUE' ? '#1d4ed8' : '#b91c1c';
  const borderColor = isSelected
    ? '#facc15'
    : owner === 'BLUE'
    ? '#60a5fa'
    : '#f87171';

  const imageUrl =
    owner === 'BLUE'
      ? card.blue_image_url || card.red_image_url
      : card.red_image_url || card.blue_image_url;

  if (faceDown) {
    return (
      <View
        style={[
          styles.card,
          styles.faceDownCard,
          { backgroundColor, borderColor, borderWidth: 1.5 },
        ]}
      >
        <Text style={styles.faceDownText}>?</Text>
      </View>
    );
  }

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
      {imageUrl ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={styles.artImage}
            resizeMode="cover"
          />
          <View style={styles.readabilityScrim} />
        </>
      ) : null}

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
    overflow: 'hidden',
  },
  artImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  readabilityScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.28)',
  },
  faceDownCard: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.85,
  },
  faceDownText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 22,
    fontWeight: '900',
  },
  middleRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statCompact: {
    fontSize: 13,
  },
  cardName: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: '700',
    maxWidth: '58%',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameCompact: {
    fontSize: 8,
  },
});