/** Port of UserLayout's SearchOverlayProvider + LocationSelectorProvider. */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "expo-router";

const SearchOverlayContext = createContext({ isSearchOpen: false, searchValue: "", setSearchValue: () => {}, openSearch: () => {}, closeSearch: () => {} });
export const useSearchOverlay = () => useContext(SearchOverlayContext);

const LocationSelectorContext = createContext({ isLocationSelectorOpen: false, openLocationSelector: () => {}, closeLocationSelector: () => {} });
export const useLocationSelector = () => useContext(LocationSelectorContext);

export function SearchOverlayProvider({ children }) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchValue("");
  }, []);
  const openLocationSelector = useCallback(() => router.push("/address-selector"), [router]);

  const searchValueMemo = useMemo(() => ({ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }), [isSearchOpen, searchValue, openSearch, closeSearch]);
  const locValue = useMemo(() => ({ isLocationSelectorOpen: false, openLocationSelector, closeLocationSelector: () => {} }), [openLocationSelector]);

  return (
    <SearchOverlayContext.Provider value={searchValueMemo}>
      <LocationSelectorContext.Provider value={locValue}>{children}</LocationSelectorContext.Provider>
    </SearchOverlayContext.Provider>
  );
}
