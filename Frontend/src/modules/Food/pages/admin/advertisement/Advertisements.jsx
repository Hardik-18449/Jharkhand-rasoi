import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Loader2, Image as ImageIcon, Megaphone, CheckCircle2, XCircle, Upload } from "lucide-react";
import { adminAPI, uploadAPI } from "@food/api";
import { toast } from "sonner";
import { Switch } from "@food/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog";
import { Button } from "@food/components/ui/button";

export default function Advertisements() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [title, setTitle] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  // File upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getAdvertisements();
      if (res?.data?.success) {
        setAds(res.data.data?.advertisements || []);
      }
    } catch (err) {
      console.error("Failed to load advertisements:", err);
      toast.error("Failed to load advertisements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingAd(null);
    setTitle("");
    setPosterUrl("");
    setIsActive(true);
    setSortOrder(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ad) => {
    setEditingAd(ad);
    setTitle(ad.title || "");
    setPosterUrl(ad.posterUrl || "");
    setIsActive(ad.isActive !== false);
    setSortOrder(ad.sortOrder || 0);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await uploadAPI.uploadMedia(file, { folder: "advertisements" });
      const uploadedUrl = res?.url || res?.data?.url || res?.secure_url;
      if (uploadedUrl) {
        setPosterUrl(uploadedUrl);
        toast.success("Poster uploaded successfully");
      } else {
        toast.error("Failed to upload poster image");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err?.message || "Failed to upload poster");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an Offer or Ad name");
      return;
    }
    if (!posterUrl.trim()) {
      toast.error("Please upload or provide a poster image");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        posterUrl: posterUrl.trim(),
        isActive,
        sortOrder: Number(sortOrder) || 0,
      };

      if (editingAd) {
        await adminAPI.updateAdvertisement(editingAd._id || editingAd.id, payload);
        toast.success("Advertisement updated successfully");
      } else {
        await adminAPI.createAdvertisement(payload);
        toast.success("Advertisement created successfully");
      }

      setIsModalOpen(false);
      fetchAds();
    } catch (err) {
      console.error("Error saving advertisement:", err);
      toast.error(err?.response?.data?.message || "Failed to save advertisement");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (ad) => {
    const id = ad._id || ad.id;
    try {
      // Optimistic update
      setAds((prev) =>
        prev.map((item) =>
          (item._id || item.id) === id ? { ...item, isActive: !item.isActive } : item
        )
      );
      await adminAPI.toggleAdvertisementStatus(id);
      toast.success(`Advertisement ${!ad.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      console.error("Toggle error:", err);
      toast.error("Failed to update status");
      fetchAds();
    }
  };

  const handleDelete = async (ad) => {
    const id = ad._id || ad.id;
    if (!window.confirm(`Are you sure you want to delete "${ad.title}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteAdvertisement(id);
      toast.success("Advertisement deleted successfully");
      setAds((prev) => prev.filter((item) => (item._id || item.id) !== id));
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete advertisement");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Home Advertisements
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage promotional posters and offers displayed in the user app home carousel
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2 rounded-xl h-11 px-5 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Add Advertisement</span>
        </Button>
      </div>

      {/* Ads List */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">
            All Advertisements ({ads.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading advertisements...</p>
          </div>
        ) : ads.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">
              No advertisements added yet
            </p>
            <p className="text-sm text-gray-400 max-w-sm">
              Create an advertisement with an offer title and poster image to feature it on the user home screen.
            </p>
            <Button
              onClick={handleOpenCreateModal}
              variant="outline"
              className="mt-2 text-primary border-primary/30 hover:bg-primary/5"
            >
              <Plus className="w-4 h-4 mr-1" /> Add your first ad
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {ads.map((ad) => (
              <div
                key={ad._id || ad.id}
                className="group relative bg-white dark:bg-[#222] border border-gray-200 dark:border-gray-700/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
              >
                {/* Poster Preview */}
                <div className="relative aspect-[16/9] w-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <img
                    src={ad.posterUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.target.src = "https://placehold.co/600x340?text=Poster+Image";
                    }}
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5">
                    {ad.isActive ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Inactive
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-1">
                      {ad.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Added on {new Date(ad.createdAt || Date.now()).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </p>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Live:
                      </span>
                      <Switch
                        checked={ad.isActive}
                        onCheckedChange={() => handleToggleStatus(ad)}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(ad)}
                        className="p-2 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Edit advertisement"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ad)}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Delete advertisement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              {editingAd ? "Edit Advertisement" : "New Advertisement"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {/* Offer / Ad Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Offer / Ad Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 50% Off On Special Biryani, Weekend Bonanza"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Poster Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Poster Image <span className="text-red-500">*</span>
              </label>
              
              {posterUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 mb-2 aspect-[16/9] bg-gray-100 dark:bg-gray-800">
                  <img
                    src={posterUrl}
                    alt="Poster preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPosterUrl("")}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                    title="Remove poster"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50 dark:bg-gray-800/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-xs text-gray-500">Uploading poster...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 bg-primary/10 text-primary rounded-full">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Click to upload poster image
                      </span>
                      <span className="text-xs text-gray-400">
                        Recommended: 16:9 ratio (e.g. 1280x720 or 800x450)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Or enter direct URL */}
              <div className="mt-2">
                <input
                  type="url"
                  placeholder="Or paste image URL directly..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Display Priority / Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0 (Lower numbers appear first)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-white text-sm"
              />
            </div>

            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Active Status</p>
                <p className="text-xs text-gray-400">Make this advertisement visible immediately</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving || uploadingImage}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || uploadingImage}
                className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : editingAd ? (
                  "Update Advertisement"
                ) : (
                  "Create Advertisement"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
