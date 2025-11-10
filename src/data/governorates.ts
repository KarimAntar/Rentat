// Egypt's 29 Governorates
export interface Governorate {
  id: string;
  name: string;
  nameAr: string;
  region: 'Greater Cairo' | 'Canal' | 'Northern Upper Egypt' | 'Assiut' | 'Sohag' | 'Qena' | 'Aswan' | 'Alexandria' | 'Beheira' | 'Matrouh' | 'Kafr El Sheikh' | 'Dakahlia' | 'Damietta' | 'Sharqia' | 'Monufia' | 'Gharbia' | 'Port Said' | 'Ismailia' | 'Suez' | 'North Sinai' | 'South Sinai' | 'Giza' | 'Faiyum' | 'Beni Suef' | 'Minya' | 'Asyut' | 'Sohag' | 'Qena' | 'Luxor' | 'Aswan' | 'Red Sea' | 'New Valley';
}

export const GOVERNORATES: Governorate[] = [
  // Greater Cairo Region
  { id: 'cairo', name: 'Cairo', nameAr: 'القاهرة', region: 'Greater Cairo' },
  { id: 'giza', name: 'Giza', nameAr: 'الجيزة', region: 'Giza' },
  { id: 'qalyubia', name: 'Qalyubia', nameAr: 'القليوبية', region: 'Greater Cairo' },
  
  // Alexandria and North Coast
  { id: 'alexandria', name: 'Alexandria', nameAr: 'الإسكندرية', region: 'Alexandria' },
  { id: 'beheira', name: 'Beheira', nameAr: 'البحيرة', region: 'Beheira' },
  { id: 'matrouh', name: 'Matrouh', nameAr: 'مطروح', region: 'Matrouh' },
  
  // Nile Delta
  { id: 'kafr-el-sheikh', name: 'Kafr El Sheikh', nameAr: 'كفر الشيخ', region: 'Kafr El Sheikh' },
  { id: 'dakahlia', name: 'Dakahlia', nameAr: 'الدقهلية', region: 'Dakahlia' },
  { id: 'damietta', name: 'Damietta', nameAr: 'دمياط', region: 'Damietta' },
  { id: 'sharqia', name: 'Sharqia', nameAr: 'الشرقية', region: 'Sharqia' },
  { id: 'monufia', name: 'Monufia', nameAr: 'المنوفية', region: 'Monufia' },
  { id: 'gharbia', name: 'Gharbia', nameAr: 'الغربية', region: 'Gharbia' },
  
  // Canal Region
  { id: 'port-said', name: 'Port Said', nameAr: 'بورسعيد', region: 'Port Said' },
  { id: 'ismailia', name: 'Ismailia', nameAr: 'الإسماعيلية', region: 'Ismailia' },
  { id: 'suez', name: 'Suez', nameAr: 'السويس', region: 'Suez' },
  
  // Sinai
  { id: 'north-sinai', name: 'North Sinai', nameAr: 'شمال سيناء', region: 'North Sinai' },
  { id: 'south-sinai', name: 'South Sinai', nameAr: 'جنوب سيناء', region: 'South Sinai' },
  
  // Upper Egypt
  { id: 'faiyum', name: 'Faiyum', nameAr: 'الفيوم', region: 'Faiyum' },
  { id: 'beni-suef', name: 'Beni Suef', nameAr: 'بني سويف', region: 'Beni Suef' },
  { id: 'minya', name: 'Minya', nameAr: 'المنيا', region: 'Minya' },
  { id: 'asyut', name: 'Asyut', nameAr: 'أسيوط', region: 'Asyut' },
  { id: 'sohag', name: 'Sohag', nameAr: 'سوهاج', region: 'Sohag' },
  { id: 'qena', name: 'Qena', nameAr: 'قنا', region: 'Qena' },
  { id: 'luxor', name: 'Luxor', nameAr: 'الأقصر', region: 'Luxor' },
  { id: 'aswan', name: 'Aswan', nameAr: 'أسوان', region: 'Aswan' },
  
  // Frontier Governorates
  { id: 'red-sea', name: 'Red Sea', nameAr: 'البحر الأحمر', region: 'Red Sea' },
  { id: 'new-valley', name: 'New Valley', nameAr: 'الوادي الجديد', region: 'New Valley' },
];

export const getGovernorateById = (id: string): Governorate | undefined => {
  return GOVERNORATES.find(gov => gov.id === id);
};

export const getGovernorateByName = (name: string): Governorate | undefined => {
  return GOVERNORATES.find(gov => 
    gov.name.toLowerCase() === name.toLowerCase() || 
    gov.nameAr === name
  );
};
