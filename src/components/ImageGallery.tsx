import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageGalleryProps {
  images: string[];
  height?: number;
  thumbnailHeight?: number;
  showThumbnails?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  height = 300, // Fixed height like the example (500px in example, but smaller for mobile)
  thumbnailHeight = 60,
  showThumbnails = true,
}) => {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const thumbnailScrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scroll thumbnail into view when currentIndex changes
    if (thumbnailScrollRef.current && showThumbnails) {
      const thumbnailWidth = thumbnailHeight * 1.2; // width including margin
      const scrollToX = Math.max(0, currentIndex * thumbnailWidth - width / 2 + thumbnailWidth / 2);
      thumbnailScrollRef.current.scrollTo({ x: scrollToX, animated: true });
    }
  }, [currentIndex, showThumbnails]);

  // Scroll to the selected image when currentIndex changes (for web/desktop)
  useEffect(() => {
    if (scrollViewRef.current) {
      const containerWidth = Math.min(width, 600);
      (scrollViewRef.current as any).scrollTo({
        x: currentIndex * containerWidth,
        animated: true,
      });
    }
  }, [currentIndex]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleThumbnailPress = (index: number) => {
    setCurrentIndex(index);
  };

  const handleScroll = (event: any) => {
    // Use the actual slide width (containerWidth) for correct web support
    const slideSize = Math.min(width, 600);
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== currentIndex) {
      setCurrentIndex(roundIndex);
    }
  };

  const renderMainImage = () => {
    // Responsive: full width on mobile, centered/capped on wide screens
    const isWideScreen = width > 600;
    const containerWidth = isWideScreen ? 600 : width;
    return (
      <View
        style={[
          styles.imageContainer,
          {
            height,
            ...(isWideScreen ? { width: containerWidth, alignSelf: 'center' } : {}),
          },
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          decelerationRate="fast"
          snapToInterval={containerWidth}
          snapToAlignment="center"
          contentInsetAdjustmentBehavior="automatic"
          scrollEnabled={true}
          style={{ height, ...(isWideScreen ? { width: containerWidth } : {}) }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: height,
          }}
        >
          {images.map((imageUrl, index) => (
            <View
              key={index}
              style={[
                styles.slideContainer,
                {
                  width: containerWidth,
                  height,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  position: 'relative',
                },
              ]}
            >
              <Image
                source={{ uri: imageUrl }}
                style={[
                  styles.mainImage,
                  {
                    maxHeight: height - 32,
                    maxWidth: '100%',
                  },
                ]}
                resizeMode="contain"
              />
              {/* Image Counter */}
              {images.length > 1 && (
                <View
                  style={[
                    styles.imageCounter,
                    {
                      top: 16,
                      right: 16,
                      zIndex: 20,
                      position: 'absolute',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text style={styles.imageCounterText}>
                    {index + 1} / {images.length}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.navButton, styles.leftButton]}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentIndex === 0 ? '#D1D5DB' : '#4639eb'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.rightButton]}
              onPress={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentIndex === images.length - 1 ? '#D1D5DB' : '#4639eb'}
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };



  const renderThumbnails = () => {
    if (!showThumbnails || images.length <= 1) return null;

    return (
      <View style={styles.thumbnailContainer}>
        <ScrollView
          ref={thumbnailScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailScrollContent}
        >
          {images.map((imageUrl, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleThumbnailPress(index)}
              style={[
                styles.thumbnailWrapper,
                { height: thumbnailHeight },
                currentIndex === index && styles.activeThumbnailWrapper,
              ]}
            >
              <Image
                source={{ uri: imageUrl }}
                style={[
                  styles.thumbnail,
                  { height: thumbnailHeight },
                ]}
              />
              {currentIndex === index && (
                <View style={styles.activeThumbnailOverlay} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (!images || images.length === 0) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Ionicons name="image" size={48} color="#D1D5DB" />
        <Text style={styles.placeholderText}>No images available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderMainImage()}
      {renderThumbnails()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: 600,
    width: '100%',
    backgroundColor: '#fff',
  },
  mainImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  slideContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCounter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4639eb',
  },
  leftButton: {
    left: 16,
  },
  rightButton: {
    right: 16,
  },
  thumbnailContainer: {
    marginTop: 12,
  },
  thumbnailScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbnailWrapper: {
    width: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnailWrapper: {
    borderColor: '#4639eb',
  },
  thumbnail: {
    width: 60,
    resizeMode: 'cover',
  },
  activeThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(70, 57, 235, 0.1)',
  },
  placeholderContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#D1D5DB',
    marginTop: 8,
    fontSize: 16,
  },
});

export default ImageGallery;
