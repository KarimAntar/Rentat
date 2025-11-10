export interface Subcategory {
  id: string;
  name: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: Subcategory[];
  popularTags?: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    icon: 'phone-portrait',
    description: 'Cameras, phones, laptops, gaming equipment, and electronic devices',
    subcategories: [
      { id: 'cameras', name: 'Cameras & Photography', description: 'DSLR, mirrorless, lenses, tripods' },
      { id: 'phones_tablets', name: 'Phones & Tablets', description: 'Smartphones, tablets, accessories' },
      { id: 'computers', name: 'Computers & Laptops', description: 'Laptops, desktops, monitors' },
      { id: 'gaming', name: 'Gaming', description: 'Consoles, games, VR headsets' },
      { id: 'audio', name: 'Audio Equipment', description: 'Speakers, headphones, microphones' },
      { id: 'tv_video', name: 'TV & Video', description: 'Televisions, projectors, streaming devices' },
      { id: 'drones', name: 'Drones & RC', description: 'Drones, remote control devices' },
      { id: 'smart_home', name: 'Smart Home', description: 'Smart speakers, security cameras, IoT devices' },
    ],
    popularTags: ['photography', 'gaming', 'streaming', 'professional', 'wireless', 'portable'],
  },
  {
    id: 'sports',
    name: 'Sports & Outdoors',
    icon: 'bicycle',
    description: 'Sports equipment, outdoor gear, fitness items, and recreational equipment',
    subcategories: [
      { id: 'fitness', name: 'Fitness Equipment', description: 'Weights, treadmills, exercise bikes' },
      { id: 'cycling', name: 'Cycling', description: 'Bikes, helmets, cycling accessories' },
      { id: 'water_sports', name: 'Water Sports', description: 'Kayaks, surfboards, diving equipment' },
      { id: 'camping', name: 'Camping & Hiking', description: 'Tents, backpacks, sleeping bags' },
      { id: 'winter_sports', name: 'Winter Sports', description: 'Skis, snowboards, winter gear' },
      { id: 'team_sports', name: 'Team Sports', description: 'Football, basketball, soccer equipment' },
      { id: 'fishing', name: 'Fishing & Hunting', description: 'Fishing rods, tackle, hunting gear' },
      { id: 'golf', name: 'Golf', description: 'Golf clubs, bags, accessories' },
    ],
    popularTags: ['outdoor', 'adventure', 'fitness', 'professional', 'beginner-friendly', 'waterproof'],
  },
  {
    id: 'tools',
    name: 'Tools & Equipment',
    icon: 'construct',
    description: 'Power tools, hand tools, construction equipment, and DIY supplies',
    subcategories: [
      { id: 'power_tools', name: 'Power Tools', description: 'Drills, saws, sanders, grinders' },
      { id: 'hand_tools', name: 'Hand Tools', description: 'Hammers, wrenches, screwdrivers' },
      { id: 'construction', name: 'Construction Equipment', description: 'Heavy machinery, scaffolding' },
      { id: 'gardening', name: 'Gardening Tools', description: 'Lawnmowers, trimmers, garden tools' },
      { id: 'automotive', name: 'Automotive Tools', description: 'Car jacks, diagnostic tools, repair equipment' },
      { id: 'measuring', name: 'Measuring & Testing', description: 'Levels, meters, measuring tools' },
      { id: 'cleaning', name: 'Cleaning Equipment', description: 'Pressure washers, vacuums, cleaning tools' },
      { id: 'safety', name: 'Safety Equipment', description: 'Hard hats, safety gear, protective equipment' },
    ],
    popularTags: ['professional', 'DIY', 'heavy-duty', 'cordless', 'precision', 'industrial'],
  },
  {
    id: 'home',
    name: 'Home & Garden',
    icon: 'home',
    description: 'Furniture, appliances, home decor, and garden equipment',
    subcategories: [
      { id: 'furniture', name: 'Furniture', description: 'Tables, chairs, sofas, bedroom furniture' },
      { id: 'appliances', name: 'Appliances', description: 'Kitchen appliances, laundry, home appliances' },
      { id: 'home_decor', name: 'Home Decor', description: 'Art, lighting, decorative items' },
      { id: 'kitchen', name: 'Kitchen & Dining', description: 'Cookware, dishes, kitchen gadgets' },
      { id: 'garden', name: 'Garden & Patio', description: 'Outdoor furniture, planters, garden decor' },
      { id: 'storage', name: 'Storage & Organization', description: 'Shelving, containers, organizers' },
      { id: 'baby_kids', name: 'Baby & Kids', description: 'Cribs, toys, baby equipment' },
      { id: 'cleaning_supplies', name: 'Cleaning Supplies', description: 'Vacuum cleaners, cleaning products' },
    ],
    popularTags: ['modern', 'vintage', 'compact', 'space-saving', 'eco-friendly', 'family-friendly'],
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    icon: 'car',
    description: 'Cars, motorcycles, boats, recreational vehicles, and transportation',
    subcategories: [
      { id: 'cars', name: 'Cars', description: 'Sedans, SUVs, trucks, luxury cars' },
      { id: 'motorcycles', name: 'Motorcycles', description: 'Motorcycles, scooters, ATVs' },
      { id: 'boats', name: 'Boats & Marine', description: 'Boats, jet skis, marine equipment' },
      { id: 'rvs', name: 'RVs & Trailers', description: 'RVs, campers, trailers' },
      { id: 'bicycles', name: 'Bicycles', description: 'Road bikes, mountain bikes, e-bikes' },
      { id: 'commercial', name: 'Commercial Vehicles', description: 'Trucks, vans, commercial equipment' },
      { id: 'parts_accessories', name: 'Parts & Accessories', description: 'Car parts, accessories, tools' },
      { id: 'specialty', name: 'Specialty Vehicles', description: 'Classic cars, luxury vehicles, exotic cars' },
    ],
    popularTags: ['luxury', 'economy', 'eco-friendly', 'automatic', 'manual', 'GPS', 'bluetooth'],
  },
  {
    id: 'party',
    name: 'Party & Events',
    icon: 'musical-notes',
    description: 'Event equipment, party supplies, entertainment, and celebration items',
    subcategories: [
      { id: 'audio_visual', name: 'Audio & Visual', description: 'Sound systems, projectors, lighting' },
      { id: 'decorations', name: 'Decorations', description: 'Backdrops, balloons, centerpieces' },
      { id: 'furniture_rentals', name: 'Event Furniture', description: 'Tables, chairs, tents, linens' },
      { id: 'catering', name: 'Catering Equipment', description: 'Serving dishes, warmers, beverage dispensers' },
      { id: 'photography', name: 'Photography & Video', description: 'Cameras, lighting, photo booths' },
      { id: 'entertainment', name: 'Entertainment', description: 'Games, inflatables, DJ equipment' },
      { id: 'wedding', name: 'Wedding Supplies', description: 'Bridal accessories, ceremony items' },
      { id: 'costumes', name: 'Costumes & Props', description: 'Costumes, masks, theatrical props' },
    ],
    popularTags: ['wedding', 'birthday', 'corporate', 'outdoor', 'elegant', 'fun', 'professional'],
  },
  {
    id: 'fashion',
    name: 'Fashion & Accessories',
    icon: 'shirt',
    description: 'Clothing, jewelry, bags, shoes, and fashion accessories',
    subcategories: [
      { id: 'formal_wear', name: 'Formal Wear', description: 'Suits, dresses, formal attire' },
      { id: 'casual_wear', name: 'Casual Wear', description: 'Everyday clothing, casual outfits' },
      { id: 'special_occasion', name: 'Special Occasion', description: 'Party dresses, cocktail attire' },
      { id: 'accessories', name: 'Accessories', description: 'Jewelry, watches, belts' },
      { id: 'bags', name: 'Bags & Luggage', description: 'Handbags, luggage, backpacks' },
      { id: 'shoes', name: 'Shoes', description: 'Formal shoes, casual shoes, specialty footwear' },
      { id: 'seasonal', name: 'Seasonal Wear', description: 'Winter coats, summer wear, holiday outfits' },
      { id: 'vintage', name: 'Vintage & Designer', description: 'Vintage items, designer pieces' },
    ],
    popularTags: ['designer', 'vintage', 'formal', 'casual', 'luxury', 'trendy', 'classic'],
  },
  {
    id: 'books',
    name: 'Books & Media',
    icon: 'library',
    description: 'Books, magazines, educational materials, and media content',
    subcategories: [
      { id: 'textbooks', name: 'Textbooks', description: 'Educational books, academic materials' },
      { id: 'fiction', name: 'Fiction', description: 'Novels, short stories, literature' },
      { id: 'non_fiction', name: 'Non-Fiction', description: 'Biographies, self-help, educational' },
      { id: 'children', name: 'Children\'s Books', description: 'Kids books, educational materials' },
      { id: 'professional', name: 'Professional Development', description: 'Business books, skill development' },
      { id: 'hobbies', name: 'Hobbies & Crafts', description: 'DIY guides, hobby books' },
      { id: 'magazines', name: 'Magazines & Periodicals', description: 'Magazines, journals, newspapers' },
      { id: 'digital_media', name: 'Digital Media', description: 'E-books, audiobooks, digital content' },
    ],
    popularTags: ['educational', 'rare', 'collector', 'bestseller', 'reference', 'latest-edition'],
  },
  {
    id: 'other',
    name: 'Other',
    icon: 'apps',
    description: 'Miscellaneous items and specialized equipment',
    subcategories: [
      { id: 'collectibles', name: 'Collectibles & Antiques', description: 'Vintage items, collectibles, antiques' },
      { id: 'art_supplies', name: 'Art & Craft Supplies', description: 'Art materials, craft supplies' },
      { id: 'musical_instruments', name: 'Musical Instruments', description: 'Guitars, keyboards, drums' },
      { id: 'pets', name: 'Pet Supplies', description: 'Pet carriers, accessories, equipment' },
      { id: 'office', name: 'Office Equipment', description: 'Printers, furniture, office supplies' },
      { id: 'specialty', name: 'Specialty Items', description: 'Unique or specialized equipment' },
      { id: 'storage', name: 'Storage Solutions', description: 'Storage containers, moving supplies' },
      { id: 'seasonal', name: 'Seasonal Items', description: 'Holiday decorations, seasonal equipment' },
    ],
    popularTags: ['unique', 'specialized', 'professional', 'vintage', 'rare', 'custom'],
  },
];

export const getCategoryById = (categoryId: string): Category | undefined => {
  return CATEGORIES.find(category => category.id === categoryId);
};

export const getSubcategoryById = (categoryId: string, subcategoryId: string): Subcategory | undefined => {
  const category = getCategoryById(categoryId);
  return category?.subcategories.find(sub => sub.id === subcategoryId);
};

export const getAllSubcategories = (): Array<Subcategory & { categoryId: string; categoryName: string }> => {
  return CATEGORIES.flatMap(category =>
    category.subcategories.map(sub => ({
      ...sub,
      categoryId: category.id,
      categoryName: category.name,
    }))
  );
};

export const searchCategories = (query: string): Category[] => {
  const lowerQuery = query.toLowerCase();
  return CATEGORIES.filter(category =>
    category.name.toLowerCase().includes(lowerQuery) ||
    category.description.toLowerCase().includes(lowerQuery) ||
    category.subcategories.some(sub =>
      sub.name.toLowerCase().includes(lowerQuery) ||
      sub.description?.toLowerCase().includes(lowerQuery)
    ) ||
    category.popularTags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
};

export const getPopularCategories = (): Category[] => {
  // Return categories in order of popularity (can be customized based on usage data)
  return [
    getCategoryById('electronics'),
    getCategoryById('vehicles'),
    getCategoryById('tools'),
    getCategoryById('sports'),
    getCategoryById('home'),
    getCategoryById('party'),
  ].filter(Boolean) as Category[];
};
