import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Board, Position } from '../types/game';
import { CardView } from './CardView';

interface BoardViewProps {
  board: Board;
  hasSelectedCard: boolean;
  onSelectSlot: (position: Position) => void;
}

export function BoardView({
  board,
  hasSelectedCard,
  onSelectSlot,
}: BoardViewProps) {
  return (
    <View style={styles.boardContainer}>
      {board.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((slot, colIndex) => {
            const isEmpty = slot === null;
            const canPlace = isEmpty && hasSelectedCard;

            return (
              <TouchableOpacity
                key={`${rowIndex}-${colIndex}`}
                activeOpacity={0.75}
                disabled={!canPlace}
                onPress={() => onSelectSlot({ row: rowIndex, col: colIndex })}
                style={[styles.slot, canPlace && styles.slotHighlight]}
              >
                {slot ? (
                  <CardView card={slot} owner={slot.owner} />
                ) : (
                  <Text style={styles.emptyText}>{canPlace ? '•' : ''}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  boardContainer: {
    width: 312,
    height: 312,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: '31.5%',
  },
  slot: {
    width: '31.5%',
    height: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  slotHighlight: {
    borderColor: '#facc15',
    borderStyle: 'dashed',
    backgroundColor: '#1e293b',
  },
  emptyText: {
    color: '#facc15',
    fontSize: 22,
    fontWeight: '700',
  },
});
