import React from 'react';
import { XStack, Text, View } from 'tamagui';
import { MapPin } from 'lucide-react-native';
import { SHELVES_6, StoreShelf } from '../components/map/StoreLayoutConstants';

export interface ResolvedLocation {
  shelfId: number;
  shelfName: string;
  aisleCode: string;
  aisleName: string;
  zoneName: string;
  displayTag: string;
  fullLocation: string;
}

const locationCache = new Map<string, ResolvedLocation>();

/**
 * Universal resolver to get exact shelf, aisle, and zone for ANY product in the supermarket.
 * Uses exact DB relations first, then keyword-based heuristic fallback matched against the 6 physical shelves.
 */
export function resolveProductLocation(product: any): ResolvedLocation {
  if (!product) {
    return {
      shelfId: 1,
      shelfName: 'Kệ 1: Đồ Ăn Vặt & Bánh Kẹo',
      aisleCode: 'A01',
      aisleName: 'Đồ Ăn Vặt & Bánh Kẹo',
      zoneName: 'Khu Bánh Kẹo & Nước Giải Khát',
      displayTag: 'Kệ 1 · Dãy A01',
      fullLocation: 'Kệ 1: Đồ Ăn Vặt & Bánh Kẹo · Dãy A01',
    };
  }

  const cacheKey = String(product.productId ?? product.id ?? `${product.productName || product.name}_${product.shelfId || ''}`);
  if (cacheKey && locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey)!;
  }

  const loc = product.location || {};
  let shelfId: number | null = Number(product.shelfId || loc.shelfId) || null;
  let shelfName: string = String(product.shelfName || loc.shelfName || '').trim();
  let aisleCode: string = String(product.aisleCode || loc.aisleCode || '').trim();
  let aisleName: string = String(product.aisleName || loc.aisleName || '').trim();
  let zoneName: string = String(product.zoneName || product.zone || loc.zoneName || loc.zone || '').trim();

  // Try matching directly from shelfId
  let foundShelf: StoreShelf | undefined = shelfId ? SHELVES_6.find(s => s.shelfId === shelfId) : undefined;

  // Try matching by aisleCode
  if (!foundShelf && aisleCode) {
    foundShelf = SHELVES_6.find(s => s.aisleCode.toLowerCase() === aisleCode.toLowerCase());
  }

  // Heuristic match by product name or category
  if (!foundShelf) {
    const rawText = `${product.productName || product.name || ''} ${product.categoryName || product.category || ''} ${product.description || ''}`.toLowerCase();
    
    // Kệ 1: Bánh kẹo, snack, oishi, socola
    if (rawText.includes('bánh') || rawText.includes('kẹo') || rawText.includes('snack') || rawText.includes('oishi') || rawText.includes('ăn vặt') || rawText.includes('khoai tây') || rawText.includes('chocopie') || rawText.includes('haribo') || rawText.includes('pocky')) {
      foundShelf = SHELVES_6.find(s => s.shelfId === 1);
    }
    // Kệ 2: Nước ngọt, nước suối, sữa, giải khát, bia, trà xanh
    else if (rawText.includes('nước') || rawText.includes('sữa') || rawText.includes('coca') || rawText.includes('pepsi') || rawText.includes('aquafina') || rawText.includes('giải khát') || rawText.includes('uống') || rawText.includes('bia') || rawText.includes('c2') || rawText.includes('sting') || rawText.includes('thực phẩm tươi sống')) {
      // note: if it mentions 'nước' or beverage
      if (rawText.includes('nước mắm') || rawText.includes('nước tương') || rawText.includes('nước cốt dừa')) {
        foundShelf = SHELVES_6.find(s => s.shelfId === 6);
      } else {
        foundShelf = SHELVES_6.find(s => s.shelfId === 2);
      }
    }
    // Kệ 3: Thịt, cá, tôm, trứng, rau, củ, quả, tươi, bơ, xà lách, heo, bò, gà
    if (!foundShelf && (rawText.includes('thịt') || rawText.includes('cá') || rawText.includes('tôm') || rawText.includes('trứng') || rawText.includes('rau') || rawText.includes('củ') || rawText.includes('quả') || rawText.includes('tươi') || rawText.includes('bơ') || rawText.includes('heo') || rawText.includes('bò') || rawText.includes('gà') || rawText.includes('hải sản') || rawText.includes('salad'))) {
      foundShelf = SHELVES_6.find(s => s.shelfId === 3);
    }
    // Kệ 4: Mì ăn liền, gạo, phở, miến, bún khô, lương khô, cháo gói
    else if (!foundShelf && (rawText.includes('mì') || rawText.includes('gạo') || rawText.includes('phở') || rawText.includes('miến') || rawText.includes('bún') || rawText.includes('hảo hảo') || rawText.includes('omachi') || rawText.includes('đóng gói') || rawText.includes('khô'))) {
      foundShelf = SHELVES_6.find(s => s.shelfId === 4);
    }
    // Kệ 5: Đồ gia dụng, giặt, xả, rửa bát, xà phòng, khăn ướt, màng bọc, thớt, chảo, nồi, giấy vệ sinh
    else if (!foundShelf && (rawText.includes('giặt') || rawText.includes('xả') || rawText.includes('rửa') || rawText.includes('tắm') || rawText.includes('gội') || rawText.includes('gia dụng') || rawText.includes('khăn') || rawText.includes('màng bọc') || rawText.includes('thớt') || rawText.includes('chảo') || rawText.includes('nồi') || rawText.includes('giấy'))) {
      foundShelf = SHELVES_6.find(s => s.shelfId === 5);
    }
    // Kệ 6: Gia vị, dầu ăn, nước mắm, nước tương, hạt nêm, dầu hào, muối, tiêu, đường, trà, tỏi, hành
    else if (!foundShelf && (rawText.includes('gia vị') || rawText.includes('dầu') || rawText.includes('mắm') || rawText.includes('hạt nêm') || rawText.includes('hào') || rawText.includes('trà') || rawText.includes('tỏi') || rawText.includes('hành') || rawText.includes('muối') || rawText.includes('tiêu') || rawText.includes('đường') || rawText.includes('tương') || rawText.includes('maggi'))) {
      foundShelf = SHELVES_6.find(s => s.shelfId === 6);
    }
  }

  if (foundShelf) {
    shelfId = foundShelf.shelfId;
    shelfName = foundShelf.name;
    aisleCode = foundShelf.aisleCode;
    aisleName = foundShelf.category;
    zoneName = foundShelf.shelfId <= 2 ? 'Khu Bánh Kẹo & Nước Giải Khát' : (foundShelf.shelfId <= 4 ? 'Khu Thực Phẩm & Mì Gói' : 'Khu Gia Vị & Gia Dụng');
  }

  // Format clean shelf name (e.g. "Kệ 3: Thực Phẩm Tươi Sống")
  let cleanShelf = shelfName || `Kệ ${shelfId || 1}`;
  cleanShelf = cleanShelf.replace(/\s*[-–]\s*/, ': ');

  const finalAisleCode = aisleCode || (shelfId ? (shelfId <= 2 ? 'A01' : shelfId <= 4 ? 'B01' : 'C01') : 'A01');
  const displayTag = `${cleanShelf.split(':')[0]} · Dãy ${finalAisleCode}`;
  const fullLocation = `${cleanShelf} · Dãy ${finalAisleCode}`;

  return {
    shelfId: shelfId || 1,
    shelfName: cleanShelf,
    aisleCode: finalAisleCode,
    aisleName: aisleName || 'Quầy Hàng Siêu Thị',
    zoneName: zoneName || 'Khu Vực Siêu Thị',
    displayTag,
    fullLocation,
  };
}

export interface ProductLocationBadgeProps {
  product: any;
  variant?: 'compact' | 'pill' | 'detailed';
  color?: string;
  bgColor?: string;
  borderColor?: string;
}

/**
 * Reusable Tamagui component to display product's physical shelf & aisle badge nicely.
 */
export const ProductLocationBadge: React.FC<ProductLocationBadgeProps> = React.memo(({
  product,
  variant = 'compact',
  color = '#166534',
  bgColor = '#F0FDF4',
  borderColor = '#BBF7D0',
}) => {
  const loc = resolveProductLocation(product);

  if (variant === 'pill') {
    return (
      <XStack
        backgroundColor={bgColor}
        borderWidth={1}
        borderColor={borderColor}
        borderRadius={12}
        paddingHorizontal="$2.5"
        paddingVertical="$1"
        alignItems="center"
        gap="$1.5"
        alignSelf="flex-start"
      >
        <MapPin size={12} color={color} />
        <Text fontSize={11.5} fontWeight="700" color={color} numberOfLines={1}>
          {loc.fullLocation}
        </Text>
      </XStack>
    );
  }

  if (variant === 'detailed') {
    return (
      <XStack
        backgroundColor={bgColor}
        borderWidth={1}
        borderColor={borderColor}
        borderRadius={8}
        paddingHorizontal="$2"
        paddingVertical="$1"
        alignItems="center"
        gap="$1"
        alignSelf="flex-start"
      >
        <MapPin size={11} color={color} />
        <Text fontSize={11} fontWeight="700" color={color} numberOfLines={1}>
          {loc.shelfName} ({loc.aisleCode})
        </Text>
      </XStack>
    );
  }

  // Default compact variant
  return (
    <XStack
      alignItems="center"
      gap="$1"
      backgroundColor={bgColor}
      paddingHorizontal="$2"
      paddingVertical="$0.5"
      borderRadius={6}
      borderWidth={1}
      borderColor={borderColor}
      alignSelf="flex-start"
    >
      <MapPin size={10} color={color} />
      <Text fontSize={10.5} fontWeight="700" color={color} numberOfLines={1}>
        {loc.displayTag}
      </Text>
    </XStack>
  );
});
