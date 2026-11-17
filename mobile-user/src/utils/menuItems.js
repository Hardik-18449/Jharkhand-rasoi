/** Port of web utils/menuItems.js */
import { getFoodDisplayPrice, getFoodVariants } from "./foodVariants";

export const getMenuFromResponse = (response) => response?.data?.data?.menu || response?.data?.menu || null;

const normalizeItem = (item = {}, sectionName = "", subsectionName = "") => ({
  ...item,
  id: String(item?.id || item?._id || ""),
  sectionName,
  subsectionName,
  image: item?.image || item?.images?.[0] || "",
  name: item?.name || "Unnamed Item",
  category: item?.category || sectionName || "Varieties",
  foodType: item?.foodType || "Non-Veg",
  price: getFoodDisplayPrice(item),
  rating: Number(item?.rating || 0),
  reviews: Number(item?.reviews || 0),
  stock: item?.stock || "Unlimited",
  approvalStatus: item?.approvalStatus || "pending",
  isAvailable: item?.isAvailable !== false,
  variants: getFoodVariants(item),
  variations: getFoodVariants(item),
});

export const flattenMenuItems = (menu) => {
  if (!menu || !Array.isArray(menu.sections)) return [];
  const items = [];
  menu.sections.forEach((section = {}) => {
    const sectionName = section?.name || "Unknown Section";
    (section?.items || []).forEach((item = {}) => items.push(normalizeItem(item, sectionName, "")));
    (section?.subsections || []).forEach((subsection = {}) => {
      const subsectionName = subsection?.name || "Unknown Subsection";
      (subsection?.items || []).forEach((item = {}) => items.push(normalizeItem(item, sectionName, subsectionName)));
    });
  });
  return items;
};
