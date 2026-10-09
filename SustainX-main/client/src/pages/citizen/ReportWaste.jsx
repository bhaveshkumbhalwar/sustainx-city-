import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitComplaint } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useWardOptions } from '../../hooks/useGeo';
import PageHeader from '../../components/ui/PageHeader';
import SectionCard from '../../components/ui/SectionCard';
import Icon from '../../components/ui/Icon';

const WASTE_TYPES = ['Mixed Waste', 'Plastic', 'Food', 'E-Waste', 'Hazardous', 'Construction', 'Other'];

const STEPS = ['Describe', 'Location', 'Submit'];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function ReportWaste() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const wardOptions = useWardOptions();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    wasteType: '',
    description: '',
    location: '',
    block: '',
    imageFile: null,
    imagePreview: null,
    lat: null,
    lng: null,
  });
  const [geoState, setGeoState] = useState('idle'); // idle | locating | ok | denied | unavailable | timeout

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const canNext = () => (step === 0 ? form.wasteType && form.description.trim() : form.location.trim() && !!form.block);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoState('unavailable');
      showToast('Geolocation is not available on this device. Enter the location manually.', 'warning');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setGeoState('ok');
        showToast('Location captured from GPS.', 'success');
      },
      (err) => {
        const state = err?.code === 1 ? 'denied' : err?.code === 3 ? 'timeout' : 'unavailable';
        setGeoState(state);
        showToast(
          state === 'denied'
            ? 'Location permission denied. Enter the location manually.'
            : 'Could not get your location. Enter it manually.',
          'warning',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // Frontend pre-validation (backend remains the authority: 400/413).
    if (!file.type.startsWith('image/')) {
      showToast('Only image files (JPG, PNG, GIF, WebP) are allowed.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image must be smaller than 5MB.', 'error');
      e.target.value = '';
      return;
    }
    set('imageFile', file);
    const reader = new FileReader();
    reader.onload = () => set('imagePreview', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('location', form.location.trim());
      fd.append('block', form.block);
      fd.append('wasteType', form.wasteType);
      fd.append('description', form.description.trim());
      fd.append('type', 'complaint');
      if (form.lat !== null && form.lng !== null) {
        fd.append('lat', String(form.lat));
        fd.append('lng', String(form.lng));
      }
      if (form.imageFile) fd.append('image', form.imageFile);
      await submitComplaint(fd);
      showToast('Report submitted. Thanks for keeping the city clean!', 'success');
      navigate('/citizen/complaints');
    } catch (err) {
      showToast(err?.message || 'Could not submit the report.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Report waste"
        subtitle="Tell us where and what — we'll route it to the right ward crew."
        icon="map-pin"
      />

      <div className="stepper-track">
        {STEPS.map((label, i) => (
          <div key={label} className={`stepper-seg ${i <= step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <span className="stepper-seg-num">{i + 1}</span>
            <span className="stepper-seg-label">{label}</span>
            {i < STEPS.length - 1 && <span className="stepper-seg-line" />}
          </div>
        ))}
      </div>

      <SectionCard className="u-mt-1">
        {step === 0 && (
          <div className="report-form">
            <div className="form-group">
              <label className="form-label">Type of waste</label>
              <select
                className="form-select"
                value={form.wasteType}
                onChange={(e) => set('wasteType', e.target.value)}
              >
                <option value="">Select waste type…</option>
                {WASTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Describe the issue</label>
              <textarea
                className="form-textarea"
                rows={5}
                placeholder="e.g. Garbage overflowing near the market entrance since last evening…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Photo (optional)</label>
              {form.imagePreview ? (
                <div className="report-image-box">
                  <img src={form.imagePreview} alt="Report preview" />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('imageFile', null)}>
                    <Icon name="close" size={14} /> Remove
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                  <Icon name="image" size={18} /> Attach a photo
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFile}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="report-form">
            <div className="form-group">
              <label className="form-label">Ward</label>
              <select className="form-select" value={form.block} onChange={(e) => set('block', e.target.value)}>
                <option value="">Select ward…</option>
                {wardOptions.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name} ({w.zone})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Location / address</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Near the fountain, main market road"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </div>
            <div className="form-group">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={useMyLocation}
                disabled={geoState === 'locating'}
              >
                <Icon name="map-pin" size={15} />
                {geoState === 'locating' ? 'Locating…' : 'Use my GPS location'}
              </button>
              {geoState === 'ok' && form.lat !== null && (
                <p className="u-text-muted u-text-sm u-mt-1">
                  GPS captured: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </p>
              )}
              {(geoState === 'denied' || geoState === 'timeout' || geoState === 'unavailable') && (
                <p className="u-text-muted u-text-sm u-mt-1">
                  GPS unavailable — the typed address above will be used instead.
                </p>
              )}
            </div>
            <p className="u-text-muted u-text-sm">
              Precise street/pin descriptions help the crew find the spot faster.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="report-review">
            <div className="report-review-row">
              <span className="report-review-label">Waste type</span>
              <span className="report-review-value">{form.wasteType || '—'}</span>
            </div>
            <div className="report-review-row">
              <span className="report-review-label">Ward</span>
              <span className="report-review-value">
                {form.block ? wardOptions.find((w) => w.code === form.block)?.name : '—'}
              </span>
            </div>
            <div className="report-review-row">
              <span className="report-review-label">Location</span>
              <span className="report-review-value">{form.location}</span>
            </div>
            <div className="report-review-row">
              <span className="report-review-label">Description</span>
              <span className="report-review-value">{form.description}</span>
            </div>
            <div className="report-review-row">
              <span className="report-review-label">Photo</span>
              <span className="report-review-value">
                {form.imageFile ? `${form.imageFile.name} (${(form.imageFile.size / 1024).toFixed(0)} KB)` : 'None'}
              </span>
            </div>
            <div className="report-review-row">
              <span className="report-review-label">GPS</span>
              <span className="report-review-value">
                {form.lat !== null ? `${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}` : 'Not captured'}
              </span>
            </div>
          </div>
        )}

        <div className="report-actions">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              <Icon name="chevronLeft" size={16} /> Back
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn btn-primary" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
              Continue <Icon name="chevronRight" size={16} />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          )}
        </div>
      </SectionCard>
    </>
  );
}