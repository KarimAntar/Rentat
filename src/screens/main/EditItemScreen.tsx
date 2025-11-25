import { showAlert } from '../../contexts/ModalContext';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import Button from '../../components/ui/Button';
import { ItemService } from '../../services/firestore';
import { StorageService } from '../../services/storage';
import { useAuthContext } from '../../contexts/AuthContext';
import { Item, ItemCondition } from '../../types';
import { CATEGORIES } from '../../data/categories';

interface EditItemScreenProps {
  route: {
    params: {
      itemId: string;
    };
  };
}

interface EditableForm {
  title: string;
  description: string;
  category: string;
  condition: ItemCondition;
  governorate: string;
  address: string;
  city: string;
  dailyRate: string;
  securityDeposit: string;
  minRentalDays: string;
  maxRentalDays: string;
  images: string[];
  existingImages: string[]; // track already uploaded images
  deliveryOptions: {
    pickup: boolean;
    delivery: boolean;
    meetInMiddle: boolean;
  };
}

const CONDITIONS: { value: ItemCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

const EditItemScreen: React.FC = (props: any) => {
  const { route, navigation } = props;
  const { itemId } = route.params as { itemId: string };
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [form, setForm] = useState<EditableForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      setLoading(true);
      const existing = await ItemService.getItem(itemId);
      if (!existing) {
        showAlert('Error', 'Item not found');
        navigation.goBack();
        return;
      }
      if (existing.ownerId !== user?.uid) {
        showAlert('Unauthorized', 'You cannot edit this item');
        navigation.goBack();
        return;
      }

      setItem(existing);
      setForm({
        title: existing.title,
        description: existing.description,
        category: existing.category,
        condition: existing.condition,
        governorate: existing.governorate,
        address: existing.location.address,
        city: existing.location.city,
        dailyRate: existing.pricing.dailyRate.toString(),
        securityDeposit: existing.pricing.securityDeposit.toString(),
        minRentalDays: existing.availability.minRentalDays.toString(),
        maxRentalDays: existing.availability.maxRentalDays.toString(),
        images: [], // new images to upload
        existingImages: existing.images || [],
        deliveryOptions: {
          pickup: existing.location.deliveryOptions.pickup,
            delivery: existing.location.deliveryOptions.delivery,
            meetInMiddle: existing.location.deliveryOptions.meetInMiddle,
        },
      });
    } catch (e) {
      showAlert('Error', 'Failed to load item');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof EditableForm>(key: K, value: EditableForm[K]) => {
    setForm(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const pickImages = async () => {
    if (!form) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets) {
        const newUris = result.assets.map(a => a.uri);
        updateField('images', [...form.images, ...newUris].slice(0, 8 - form.existingImages.length));
      }
    } catch {
      showAlert('Error', 'Could not pick images');
    }
  };

  const takePhoto = async () => {
    if (!form) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        updateField('images', [...form.images, result.assets[0].uri].slice(0, 8 - form.existingImages.length));
      }
    } catch {
      showAlert('Error', 'Could not take photo');
    }
  };

  const removeExistingImage = (index: number) => {
    if (!form) return;
    const updated = form.existingImages.filter((_, i) => i !== index);
    updateField('existingImages', updated);
  };

  const removeNewImage = (index: number) => {
    if (!form) return;
    const updated = form.images.filter((_, i) => i !== index);
    updateField('images', updated);
  };

  const validate = (): boolean => {
    if (!form) return false;
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title required';
    if (!form.description.trim()) errs.description = 'Description required';
    if (!form.category) errs.category = 'Category required';
    if (!form.dailyRate || isNaN(parseFloat(form.dailyRate)) || parseFloat(form.dailyRate) <= 0) {
      errs.dailyRate = 'Daily rate invalid';
    }
    if (!form.securityDeposit || isNaN(parseFloat(form.securityDeposit)) || parseFloat(form.securityDeposit) < 0) {
      errs.securityDeposit = 'Deposit invalid';
    }
    if (form.existingImages.length + form.images.length === 0) errs.images = 'At least one image required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!form || !item) return;
    if (!validate()) return;
    setSaving(true);
    try {
      let finalImages = [...form.existingImages];

      // Upload new images if any
      if (form.images.length > 0) {
        const uploads = await StorageService.uploadItemImages(form.images, item.id);
        finalImages = [...finalImages, ...uploads.map(u => u.url)];
      }

      await ItemService.updateItem(item.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        condition: form.condition,
        governorate: form.governorate,
        images: finalImages,
        pricing: {
          ...item.pricing,
          dailyRate: parseFloat(form.dailyRate),
          securityDeposit: parseFloat(form.securityDeposit),
        },
        availability: {
          ...item.availability,
          minRentalDays: form.minRentalDays ? parseInt(form.minRentalDays) : item.availability.minRentalDays,
          maxRentalDays: form.maxRentalDays ? parseInt(form.maxRentalDays) : item.availability.maxRentalDays,
        },
        location: {
          ...item.location,
          address: form.address,
          city: form.city,
          deliveryOptions: {
            pickup: form.deliveryOptions.pickup,
            delivery: form.deliveryOptions.delivery,
            meetInMiddle: form.deliveryOptions.meetInMiddle,
          },
        },
      } as any);

      Toast.show({
        type: 'success',
        text1: 'Item Updated',
        text2: 'Your changes have been saved.',
        position: 'top',
      });

      navigation.navigate('ItemDetails', { itemId: item.id });
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading || !form) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading item...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Images</Text>
          <View style={styles.imageRow}>
            {form.existingImages.map((uri, idx) => (
              <View key={`existing-${idx}`} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => removeExistingImage(idx)}
                >
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {form.images.map((uri, idx) => (
              <View key={`new-${idx}`} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => removeNewImage(idx)}
                >
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {(form.existingImages.length + form.images.length) < 8 && (
              <TouchableOpacity style={styles.addImage} onPress={pickImages}>
                <Ionicons name="add" size={32} color="#6B7280" />
                <Text style={styles.addImageText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.inlineBtn} onPress={pickImages}>
              <Ionicons name="images" size={18} color="#4639eb" />
              <Text style={styles.inlineBtnText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inlineBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={18} color="#4639eb" />
              <Text style={styles.inlineBtnText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Basic Info</Text>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={[styles.input, errors.title ? styles.inputError : null]}
              value={form.title}
              onChangeText={t => updateField('title', t)}
              placeholder="Listing title"
              maxLength={100}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.textArea, errors.description ? styles.inputError : null]}
              value={form.description}
              onChangeText={t => updateField('description', t)}
              placeholder="Describe the item..."
              multiline
              numberOfLines={5}
              maxLength={1500}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

            <Text style={styles.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    form.category === cat.id && styles.categoryChipActive
                  ]}
                  onPress={() => updateField('category', cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={18}
                    color={form.category === cat.id ? '#FFFFFF' : '#4639eb'}
                  />
                  <Text style={[
                    styles.categoryChipText,
                    form.category === cat.id && styles.categoryChipTextActive
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

            <Text style={styles.label}>Condition *</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.conditionChip,
                    form.condition === c.value && styles.conditionChipActive
                  ]}
                  onPress={() => updateField('condition', c.value)}
                >
                  <Text style={[
                    styles.conditionChipText,
                    form.condition === c.value && styles.conditionChipTextActive
                  ]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          <Text style={styles.sectionTitle}>Pricing</Text>
          <Text style={styles.label}>Daily Rate *</Text>
          <TextInput
            style={[styles.input, errors.dailyRate ? styles.inputError : null]}
            value={form.dailyRate}
            onChangeText={t => updateField('dailyRate', t)}
            keyboardType="decimal-pad"
            placeholder="25.00"
          />
          {errors.dailyRate && <Text style={styles.errorText}>{errors.dailyRate}</Text>}

          <Text style={styles.label}>Security Deposit *</Text>
          <TextInput
            style={[styles.input, errors.securityDeposit ? styles.inputError : null]}
            value={form.securityDeposit}
            onChangeText={t => updateField('securityDeposit', t)}
            keyboardType="decimal-pad"
            placeholder="50.00"
          />
          {errors.securityDeposit && <Text style={styles.errorText}>{errors.securityDeposit}</Text>}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Min Days</Text>
              <TextInput
                style={styles.input}
                value={form.minRentalDays}
                onChangeText={t => updateField('minRentalDays', t)}
                keyboardType="number-pad"
                placeholder="1"
                maxLength={3}
              />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Max Days</Text>
              <TextInput
                style={styles.input}
                value={form.maxRentalDays}
                onChangeText={t => updateField('maxRentalDays', t)}
                keyboardType="number-pad"
                placeholder="30"
                maxLength={3}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Delivery Options</Text>
          {(['pickup','delivery','meetInMiddle'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              style={styles.checkboxRow}
              onPress={() => updateField('deliveryOptions', {
                ...form.deliveryOptions,
                [opt]: !form.deliveryOptions[opt]
              })}
            >
              <Ionicons
                name={form.deliveryOptions[opt] ? 'checkbox' : 'square-outline'}
                size={22}
                color="#4639eb"
              />
              <Text style={styles.checkboxLabel}>
                {opt === 'pickup' && 'Pickup at my location'}
                {opt === 'delivery' && 'I can deliver'}
                {opt === 'meetInMiddle' && 'Meet halfway'}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.label}>Governorate *</Text>
          <TextInput
            style={styles.input}
            value={form.governorate}
            onChangeText={t => updateField('governorate', t)}
            placeholder="Select governorate"
          />

          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            value={form.city}
            onChangeText={t => updateField('city', t)}
            placeholder="Enter city"
          />

          <Text style={styles.label}>Address *</Text>
          <TextInput
            style={styles.input}
            value={form.address}
            onChangeText={t => updateField('address', t)}
            placeholder="Enter detailed address"
          />

          <View style={{ height: 32 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Discard"
            onPress={handleCancel}
            variant="outline"
            style={styles.footerBtn}
          />
          <Button
            title={saving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.footerBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#FFFFFF' },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  loadingText:{ fontSize:16, color:'#6B7280' },
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  headerTitle:{ fontSize:18, fontWeight:'600', color:'#111827' },
  content:{ flex:1, paddingHorizontal:16 },
  sectionTitle:{ fontSize:18, fontWeight:'700', color:'#111827', marginTop:24, marginBottom:12 },
  label:{ fontSize:14, fontWeight:'600', color:'#374151', marginBottom:6, marginTop:4 },
  input:{ borderWidth:1, borderColor:'#D1D5DB', borderRadius:8, padding:12, fontSize:16, backgroundColor:'#FFFFFF' },
  inputError:{ borderColor:'#EF4444' },
  textArea:{ borderWidth:1, borderColor:'#D1D5DB', borderRadius:8, padding:12, fontSize:16, backgroundColor:'#FFFFFF', minHeight:120, textAlignVertical:'top' },
  imageRow:{ flexDirection:'row', flexWrap:'wrap', gap:12 },
  imageWrapper:{ width:80, height:80, borderRadius:8, overflow:'hidden', position:'relative' },
  image:{ width:'100%', height:'100%', resizeMode:'cover' },
  removeBadge:{ position:'absolute', top:-6, right:-6 },
  addImage:{ width:80, height:80, borderRadius:8, borderWidth:2, borderColor:'#D1D5DB', borderStyle:'dashed', justifyContent:'center', alignItems:'center' },
  addImageText:{ fontSize:10, color:'#6B7280', marginTop:4 },
  inlineActions:{ flexDirection:'row', gap:12, marginTop:12 },
  inlineBtn:{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#F3F4F6', paddingVertical:8, paddingHorizontal:12, borderRadius:8 },
  inlineBtnText:{ color:'#4639eb', fontWeight:'500' },
  categoryChip:{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, backgroundColor:'#F3F4F6', borderRadius:20, marginRight:8, borderWidth:1, borderColor:'#E5E7EB' },
  categoryChipActive:{ backgroundColor:'#4639eb', borderColor:'#4639eb' },
  categoryChipText:{ fontSize:12, color:'#4639eb', fontWeight:'500' },
  categoryChipTextActive:{ color:'#FFFFFF' },
  conditionRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:4 },
  conditionChip:{ paddingVertical:6, paddingHorizontal:14, borderRadius:20, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB' },
  conditionChipActive:{ backgroundColor:'#4639eb', borderColor:'#4639eb' },
  conditionChipText:{ fontSize:12, color:'#374151', fontWeight:'500' },
  conditionChipTextActive:{ color:'#FFFFFF' },
  row:{ flexDirection:'row', marginTop:12 },
  checkboxRow:{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:8 },
  checkboxLabel:{ fontSize:14, color:'#111827' },
  errorText:{ color:'#EF4444', fontSize:12, marginTop:4 },
  footer:{ flexDirection:'row', padding:16, borderTopWidth:1, borderTopColor:'#E5E7EB', backgroundColor:'#FFFFFF', gap:12 },
  footerBtn:{ flex:1 },
});

export default EditItemScreen;


