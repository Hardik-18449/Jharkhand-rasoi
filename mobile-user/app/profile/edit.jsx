/** Port of pages/user/profile/EditProfile.jsx (MUI DatePicker → native date picker; file input → camera/gallery sheet). */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { ArrowLeft, X, Pencil, Camera, Image as ImageIcon, Calendar, ChevronDown, Check } from "lucide-react-native";
import Txt from "../../src/components/ui/Txt";
import Screen from "../../src/components/ui/Screen";
import AppImage from "../../src/components/ui/AppImage";
import BottomSheet from "../../src/components/ui/BottomSheet";
import RequireAuth from "../../src/components/RequireAuth";
import { useProfile } from "../../src/context/ProfileContext";
import { userAPI } from "../../src/api";
import { localStore } from "../../src/utils/storage";
import { dispatchAppEvent } from "../../src/utils/events";
import { getImageValidationError, getUploadErrorMessage, EMAIL_REGEX } from "../../src/utils/uploadErrors";
import { toast } from "../../src/utils/toast";
import { palette, fonts } from "../../src/theme";

const DRAFT_KEY = "user_edit_profile_draft";
const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];
const readJson = (k) => {
  try {
    const r = localStore.getItem(k);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
};
const loadProfileFromStorage = () => {
  for (const k of ["user_user", "userProfile", "tuggo_user_profile"]) {
    const v = readJson(k);
    if (v) return v;
  }
  return null;
};
const saveProfileToStorage = (d) => {
  localStore.setItem("user_user", JSON.stringify(d));
  localStore.setItem("userProfile", JSON.stringify(d));
};
const tenDigits = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const build = (p = {}) => ({
  name: p.name || "",
  mobile: tenDigits(p.mobile || p.phone || ""),
  email: p.email || "",
  dateOfBirth: p.dateOfBirth ? dayjs(p.dateOfBirth) : null,
  anniversary: p.anniversary ? dayjs(p.anniversary) : null,
  gender: p.gender || "",
});
const fmtDate = (d) => (d ? d.format("YYYY-MM-DD") : null);
const serialize = (f) => JSON.stringify({ ...f, dateOfBirth: fmtDate(f.dateOfBirth), anniversary: fmtDate(f.anniversary) });

function EditProfileScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile } = useProfile();
  const draft = useRef(readJson(DRAFT_KEY)).current;
  const initialProfile = draft || loadProfileFromStorage() || userProfile || {};
  const [formData, setFormData] = useState(() => build(initialProfile));
  const [initialData] = useState(() => serialize(build(initialProfile)));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "");
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const [datePicker, setDatePicker] = useState(null); // "dateOfBirth" | "anniversary"
  const [fieldErrors, setFieldErrors] = useState({ mobile: "", email: "", dateOfBirth: "" });
  const hydratedFromDraft = useRef(Boolean(draft));

  useEffect(() => {
    if (hydratedFromDraft.current) return;
    const p = loadProfileFromStorage() || userProfile || {};
    setFormData(build(p));
    if (p.profileImage) {
      setProfileImage(p.profileImage);
      setImagePreview(p.profileImage);
    }
  }, [userProfile]);
  useEffect(() => {
    localStore.setItem(DRAFT_KEY, JSON.stringify({ name: formData.name, phone: formData.mobile, mobile: formData.mobile, email: formData.email, profileImage, dateOfBirth: fmtDate(formData.dateOfBirth), anniversary: fmtDate(formData.anniversary), gender: formData.gender || "" }));
  }, [formData, profileImage]);
  const hasChanges = serialize(formData) !== initialData;

  const validateEmail = (v) => (!v ? "Email is required" : EMAIL_REGEX.test(v) ? "" : "Please enter a valid email");
  const validateMobile = (v) => (!v ? "" : /^\d{10}$/.test(v) ? "" : "Mobile number must be 10 digits");
  const validateDob = (v) => {
    if (!v) return "";
    const d = dayjs(v);
    if (!d.isValid()) return "Please select a valid date of birth";
    return d.isAfter(dayjs(), "day") ? "Date of birth cannot be in the future" : "";
  };
  const handleChange = (field, value) => {
    let v = value;
    let err = "";
    if (field === "mobile") {
      v = String(value || "").replace(/\D/g, "").slice(0, 10);
      err = validateMobile(v);
    } else if (field === "email") {
      v = String(value || "").trim();
      err = validateEmail(v);
    } else if (field === "dateOfBirth") err = validateDob(v);
    setFormData((p) => ({ ...p, [field]: v }));
    if (["mobile", "email", "dateOfBirth"].includes(field)) setFieldErrors((p) => ({ ...p, [field]: err }));
  };

  const processAsset = async (asset) => {
    if (!asset) return;
    const file = { uri: asset.uri, name: asset.fileName || `profile-photo-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg", size: asset.fileSize };
    const vErr = getImageValidationError(file);
    if (vErr) return toast.error(vErr);
    setImagePreview(asset.uri);
    try {
      setIsUploadingImage(true);
      const r = await userAPI.uploadProfileImage(file);
      const url = r?.data?.data?.profileImage || r?.data?.profileImage;
      if (url) {
        setProfileImage(url);
        setImagePreview(url);
        toast.success("Profile image uploaded successfully");
        const merged = { ...(userProfile || {}), name: formData.name, phone: formData.mobile, mobile: formData.mobile, email: formData.email, dateOfBirth: fmtDate(formData.dateOfBirth), anniversary: fmtDate(formData.anniversary), gender: formData.gender || "", profileImage: url };
        updateUserProfile(merged);
        saveProfileToStorage(merged);
        localStore.setItem(DRAFT_KEY, JSON.stringify(merged));
        dispatchAppEvent("userAuthChanged");
      }
    } catch (e) {
      toast.error(getUploadErrorMessage(e));
      setImagePreview(profileImage);
    } finally {
      setIsUploadingImage(false);
    }
    return undefined;
  };
  const pick = async (source) => {
    setPhotoPickerOpen(false);
    try {
      const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return toast.error(source === "camera" ? "Camera permission denied" : "Photo access denied");
      const opts = { mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] };
      const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets?.[0]) await processAsset(res.assets[0]);
    } catch {
      toast.error("Failed to open image picker");
    }
    return undefined;
  };

  const handleUpdate = async () => {
    if (isSaving) return;
    const next = { mobile: validateMobile(formData.mobile), email: validateEmail(formData.email), dateOfBirth: validateDob(formData.dateOfBirth) };
    setFieldErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    try {
      setIsSaving(true);
      const r = await userAPI.updateProfile({ name: formData.name, email: formData.email || undefined, dateOfBirth: fmtDate(formData.dateOfBirth) || undefined, anniversary: fmtDate(formData.anniversary) || undefined, gender: formData.gender || undefined, profileImage: profileImage || undefined });
      const u = r?.data?.data?.user || r?.data?.user;
      if (u) {
        updateUserProfile({ ...u, phone: u.phone || formData.mobile, profileImage: u.profileImage || profileImage });
        saveProfileToStorage({ name: u.name || formData.name, phone: u.phone || formData.mobile, mobile: u.phone || formData.mobile, email: u.email || formData.email, profileImage: u.profileImage || profileImage, dateOfBirth: u.dateOfBirth || fmtDate(formData.dateOfBirth), anniversary: u.anniversary || fmtDate(formData.anniversary), gender: u.gender || formData.gender });
        localStore.removeItem(DRAFT_KEY);
        dispatchAppEvent("userAuthChanged");
        toast.success("Profile updated successfully");
        router.replace("/profile");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const enabled = hasChanges && !isSaving && !isUploadingImage;
  const DateField = ({ field, label, optional }) => (
    <View style={{ gap: 6 }}>
      <Txt weight={500} style={styles.label}>{label} {optional ? <Txt weight={400} style={{ color: palette.gray400 }}>(Optional)</Txt> : null}</Txt>
      <Pressable onPress={() => setDatePicker(field)} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <Txt weight={400} style={{ fontSize: 16, color: formData[field] ? palette.gray900 : palette.gray400 }}>{formData[field] ? formData[field].format("DD/MM/YYYY") : "DD/MM/YYYY"}</Txt>
        <Calendar size={20} color={palette.gray500} />
      </Pressable>
      {field === "dateOfBirth" && fieldErrors.dateOfBirth ? <Txt weight={400} style={styles.err}>{fieldErrors.dateOfBirth}</Txt> : null}
    </View>
  );

  return (
    <Screen bg="#f5f5f5">
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))} style={styles.back}><ArrowLeft size={20} color={palette.gray700} /></Pressable>
        <Txt weight={600} style={{ fontSize: 18, color: palette.gray900 }}>Your Profile</Txt>
      </View>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingVertical: 24, paddingBottom: 112, gap: 24 }}>
          <View style={{ alignItems: "center" }}>
            <View>
              <View style={styles.avatar}>
                {imagePreview ? <AppImage src={imagePreview} style={StyleSheet.absoluteFill} placeholderType="avatar" width={300} /> : <Txt weight={600} style={{ fontSize: 30, color: palette.white }}>{formData.name?.charAt(0).toUpperCase() || "A"}</Txt>}
              </View>
              <Pressable disabled={isUploadingImage} onPress={() => setPhotoPickerOpen(true)} style={[styles.editBadge, isUploadingImage && { opacity: 0.5 }]}>
                {isUploadingImage ? <ActivityIndicator size="small" color={palette.white} /> : <Pencil size={16} color={palette.white} />}
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { gap: 16 }]}>
            <View style={{ gap: 6 }}>
              <Txt weight={500} style={styles.label}>Name</Txt>
              <View style={{ justifyContent: "center" }}>
                <TextInput value={formData.name} onChangeText={(t) => handleChange("name", t)} placeholder="Name" placeholderTextColor={palette.gray400} style={[styles.input, { paddingRight: 40 }]} />
                {formData.name ? (
                  <Pressable onPress={() => setFormData((p) => ({ ...p, name: "" }))} style={{ position: "absolute", right: 12 }} hitSlop={8}><X size={20} color={palette.gray400} /></Pressable>
                ) : null}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Txt weight={500} style={styles.label}>Mobile</Txt>
              <TextInput value={formData.mobile} onChangeText={(t) => handleChange("mobile", t)} keyboardType="phone-pad" placeholder="Mobile" placeholderTextColor={palette.gray400} style={styles.input} />
              {fieldErrors.mobile ? <Txt weight={400} style={styles.err}>{fieldErrors.mobile}</Txt> : null}
            </View>
            <View style={{ gap: 6 }}>
              <Txt weight={500} style={styles.label}>Email</Txt>
              <TextInput value={formData.email} onChangeText={(t) => handleChange("email", t)} keyboardType="email-address" autoCapitalize="none" placeholder="Email" placeholderTextColor={palette.gray400} style={styles.input} />
              {fieldErrors.email ? <Txt weight={400} style={styles.err}>{fieldErrors.email}</Txt> : null}
            </View>
            <DateField field="dateOfBirth" label="Date of birth" />
            <DateField field="anniversary" label="Anniversary" optional />
            <View style={{ gap: 6 }}>
              <Txt weight={500} style={styles.label}>Gender</Txt>
              <Pressable onPress={() => setGenderOpen(true)} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <Txt weight={400} style={{ fontSize: 16, color: formData.gender ? palette.gray900 : palette.gray400 }}>{genderOptions.find((g) => g.value === formData.gender)?.label || "Gender"}</Txt>
                <ChevronDown size={18} color={palette.gray500} />
              </Pressable>
            </View>
          </View>

          <Pressable disabled={!enabled} onPress={handleUpdate} style={[styles.save, { backgroundColor: enabled ? palette.yellow : palette.gray200 }]}>
            {isSaving ? <ActivityIndicator size="small" color={palette.black} /> : null}
            <Txt weight={600} style={{ fontSize: 16, color: enabled ? palette.black : palette.gray400 }}>{isSaving ? "Saving..." : "Update profile"}</Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {datePicker ? (
        <DateTimePicker
          value={(formData[datePicker] || dayjs()).toDate()}
          mode="date"
          display="default"
          maximumDate={datePicker === "dateOfBirth" ? new Date() : undefined}
          onChange={(event, date) => {
            const f = datePicker;
            setDatePicker(null);
            if (event.type === "set" && date) handleChange(f, dayjs(date));
          }}
        />
      ) : null}

      <BottomSheet visible={photoPickerOpen} onClose={() => setPhotoPickerOpen(false)}>
        <View style={{ padding: 20, gap: 12 }}>
          <Txt weight={700} style={{ fontSize: 18, color: palette.gray900 }}>Update profile photo</Txt>
          <Txt weight={400} style={{ fontSize: 14, color: palette.gray500 }}>Choose how you want to upload your profile photo.</Txt>
          <Pressable onPress={() => pick("camera")} style={styles.sourceBtn}><Camera size={20} color={palette.gray800} /><Txt weight={500} style={{ fontSize: 15, color: palette.gray900 }}>Take a photo</Txt></Pressable>
          <Pressable onPress={() => pick("gallery")} style={styles.sourceBtn}><ImageIcon size={20} color={palette.gray800} /><Txt weight={500} style={{ fontSize: 15, color: palette.gray900 }}>Choose from gallery</Txt></Pressable>
        </View>
      </BottomSheet>

      <BottomSheet visible={genderOpen} onClose={() => setGenderOpen(false)}>
        <View style={{ paddingVertical: 12 }}>
          {genderOptions.map((g) => (
            <Pressable
              key={g.value}
              onPress={() => {
                handleChange("gender", g.value);
                setGenderOpen(false);
              }}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Txt weight={formData.gender === g.value ? 600 : 400} style={{ fontSize: 15, color: palette.gray900 }}>{g.label}</Txt>
              {formData.gender === g.value ? <Check size={18} color={palette.amber600} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

export default function EditProfileRoute() {
  return (
    <RequireAuth>
      <EditProfileScreen />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: palette.white, borderBottomWidth: 1, borderColor: palette.gray100 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: palette.yellow, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.amber600, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center", elevation: 4 },
  card: { backgroundColor: palette.white, borderRadius: 12, padding: 16, elevation: 1 },
  label: { fontSize: 14, color: palette.gray700 },
  input: { height: 48, borderWidth: 1, borderColor: palette.gray300, borderRadius: 8, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16, color: palette.gray900, backgroundColor: palette.white },
  err: { fontSize: 12, color: palette.red600 },
  save: { height: 56, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sourceBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.gray200 },
});
