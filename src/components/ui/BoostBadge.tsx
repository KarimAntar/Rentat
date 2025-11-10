import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ItemBoost } from '../../types';

interface BoostBadgeProps {
  boost?: ItemBoost;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export const BoostBadge: React.FC<BoostBadgeProps> = ({
  boost,
  size = 'medium',
  style,
}) => {
  if (!boost?.isActive || !boost.badge) {
    return null;
  }

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  const textSizeStyles = {
    small: styles.smallText,
    medium: styles.mediumText,
    large: styles.largeText,
  };

  return (
    <View
      style={[
        styles.container,
        sizeStyles[size],
        { backgroundColor: boost.badge.color },
        style,
      ]}
    >
      <Text style={[styles.text, textSizeStyles[size]]}>
        {boost.badge.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeText: {
    fontSize: 14,
  },
});

export default BoostBadge;
