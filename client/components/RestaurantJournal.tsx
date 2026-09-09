'use client';

import { FormEvent, useMemo, useState } from 'react';
import type {
  Restaurant,
  Visit,
  VisitCreationResult,
} from '@/lib/types';

interface RestaurantJournalProps {
  initialRestaurants: Restaurant[];
  initialVisits: Visit[];
}

interface RestaurantFormState {
  name: string;
  cuisine: string;
  address: string;
  rating: string;
}

interface VisitFormState {
  restaurantMode: 'existing' | 'new';
  restaurantId: string;
  newName: string;
  newCuisine: string;
  newAddress: string;
  date: string;
  amountSpent: string;
  rating: string;
  notes: string;
}

const emptyRestaurantForm: RestaurantFormState = {
  name: '',
  cuisine: '',
  address: '',
  rating: '',
};

function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyVisitForm(restaurantId?: number): VisitFormState {
  return {
    restaurantMode: 'existing',
    restaurantId: restaurantId ? String(restaurantId) : '',
    newName: '',
    newCuisine: '',
    newAddress: '',
    date: localToday(),
    amountSpent: '',
    rating: '5',
    notes: '',
  };
}

async function requestJson<T>(
  path: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(path, options);
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Something went wrong. Please try again.';
    throw new Error(message);
  }

  return payload as T;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function readableDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function Stars({ rating, compact = false }: { rating: number; compact?: boolean }) {
  const filled = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span className={`tracking-[-0.08em] text-[#f4512c] ${compact ? 'text-sm' : 'text-lg'}`}>
        {Array.from({ length: 5 }, (_, index) =>
          index < filled ? '★' : '☆'
        ).join('')}
      </span>
      <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-stone-700`}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const numericValue = Number(value);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={numericValue === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className={`grid h-10 w-10 place-items-center rounded-lg text-2xl transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
            star <= numericValue
              ? 'bg-orange-50 text-[#f4512c]'
              : 'bg-stone-100 text-stone-300'
          }`}
          onClick={() => onChange(String(star))}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function RestaurantJournal({
  initialRestaurants,
  initialVisits,
}: RestaurantJournalProps) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);
  const [visits, setVisits] = useState(initialVisits);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(
    initialRestaurants[0]?.id ?? null
  );
  const [search, setSearch] = useState('');
  const [restaurantModalOpen, setRestaurantModalOpen] = useState(false);
  const [editingRestaurantId, setEditingRestaurantId] = useState<number | null>(null);
  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurantForm);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [visitForm, setVisitForm] = useState(() =>
    emptyVisitForm(initialRestaurants[0]?.id)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return restaurants;
    return restaurants.filter((restaurant) =>
      [restaurant.name, restaurant.cuisine, restaurant.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [restaurants, search]);

  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
    null;
  const selectedVisits = visits
    .filter((visit) => visit.restaurantId === selectedRestaurantId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt)
    );
  const totalSpent = visits.reduce(
    (sum, visit) => sum + (visit.amountSpent ?? 0),
    0
  );
  const reviewedRestaurantCount = new Set(
    visits.map((visit) => visit.restaurantId)
  ).size;

  function visitsFor(restaurantId: number): Visit[] {
    return visits.filter((visit) => visit.restaurantId === restaurantId);
  }

  function restaurantRating(restaurant: Restaurant): number | null {
    const reviewRatings = visitsFor(restaurant.id)
      .map((visit) => visit.rating)
      .filter((rating): rating is number => rating !== null);
    if (reviewRatings.length === 0) return restaurant.rating;
    return (
      reviewRatings.reduce((sum, rating) => sum + rating, 0) /
      reviewRatings.length
    );
  }

  function showNotice(message: string) {
    setError(null);
    setNotice(message);
  }

  function showError(error: unknown) {
    setNotice(null);
    setError(error instanceof Error ? error.message : 'Something went wrong.');
  }

  function openNewRestaurant() {
    setEditingRestaurantId(null);
    setRestaurantForm(emptyRestaurantForm);
    setError(null);
    setRestaurantModalOpen(true);
  }

  function openEditRestaurant(restaurant: Restaurant) {
    setEditingRestaurantId(restaurant.id);
    setRestaurantForm({
      name: restaurant.name,
      cuisine: restaurant.cuisine ?? '',
      address: restaurant.address ?? '',
      rating: restaurant.rating === null ? '' : String(restaurant.rating),
    });
    setError(null);
    setRestaurantModalOpen(true);
  }

  async function saveRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: restaurantForm.name,
        cuisine: restaurantForm.cuisine || null,
        address: restaurantForm.address || null,
        rating:
          restaurantForm.rating === '' ? null : Number(restaurantForm.rating),
      };
      const editing = editingRestaurantId !== null;
      const restaurant = await requestJson<Restaurant>(
        editing
          ? `/api/restaurants/${editingRestaurantId}`
          : '/api/restaurants',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      setRestaurants((current) =>
        editing
          ? current.map((item) => (item.id === restaurant.id ? restaurant : item))
          : [restaurant, ...current]
      );
      setSelectedRestaurantId(restaurant.id);
      setRestaurantModalOpen(false);
      showNotice(editing ? 'Restaurant updated.' : 'Restaurant added to the list.');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteRestaurant(restaurant: Restaurant) {
    const confirmed = window.confirm(
      `Delete ${restaurant.name}? Its reviews will be deleted too.`
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await requestJson<null>(`/api/restaurants/${restaurant.id}`, {
        method: 'DELETE',
      });
      const remaining = restaurants.filter((item) => item.id !== restaurant.id);
      setRestaurants(remaining);
      setVisits((current) =>
        current.filter((visit) => visit.restaurantId !== restaurant.id)
      );
      setSelectedRestaurantId(remaining[0]?.id ?? null);
      showNotice('Restaurant and its reviews deleted.');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function openNewVisit(restaurantId?: number) {
    setEditingVisitId(null);
    setVisitForm(emptyVisitForm(restaurantId ?? selectedRestaurantId ?? undefined));
    setError(null);
    setVisitModalOpen(true);
  }

  function openEditVisit(visit: Visit) {
    setEditingVisitId(visit.id);
    setVisitForm({
      restaurantMode: 'existing',
      restaurantId: String(visit.restaurantId),
      newName: '',
      newCuisine: '',
      newAddress: '',
      date: visit.date,
      amountSpent: visit.amountSpent === null ? '' : String(visit.amountSpent),
      rating: visit.rating === null ? '5' : String(visit.rating),
      notes: visit.notes ?? '',
    });
    setError(null);
    setVisitModalOpen(true);
  }

  async function saveVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const details = {
        date: visitForm.date,
        amountSpent: Number(visitForm.amountSpent),
        rating: Number(visitForm.rating),
        notes: visitForm.notes || null,
      };

      if (editingVisitId !== null) {
        const visit = await requestJson<Visit>(
          `/api/visits/${editingVisitId}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(details),
          }
        );
        setVisits((current) =>
          current.map((item) => (item.id === visit.id ? visit : item))
        );
        setVisitModalOpen(false);
        showNotice('Review updated. Brennen stands by it—for now.');
      } else {
        const restaurant =
          visitForm.restaurantMode === 'existing'
            ? { type: 'existing' as const, id: Number(visitForm.restaurantId) }
            : {
                type: 'new' as const,
                name: visitForm.newName,
                cuisine: visitForm.newCuisine || null,
                address: visitForm.newAddress || null,
              };
        const result = await requestJson<VisitCreationResult>('/api/visits', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ restaurant, ...details }),
        });

        setRestaurants((current) =>
          current.some((item) => item.id === result.restaurant.id)
            ? current
            : [result.restaurant, ...current]
        );
        setVisits((current) => [result.visit, ...current]);
        setSelectedRestaurantId(result.restaurant.id);
        setVisitModalOpen(false);
        showNotice(
          result.restaurantCreated
            ? 'New restaurant and first review added.'
            : 'Review added. Another receipt enters the archive.'
        );
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteVisit(visit: Visit) {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;

    setBusy(true);
    try {
      await requestJson<null>(`/api/visits/${visit.id}`, { method: 'DELETE' });
      setVisits((current) => current.filter((item) => item.id !== visit.id));
      showNotice('Review deleted. The receipt has left the building.');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-3xl bg-stone-950 px-6 py-7 text-white shadow-xl shadow-orange-950/10 sm:px-8 sm:py-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-200">
              Brennen&apos;s personal food desk
            </p>
            <h2 className="font-brand text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">
              One man. Many restaurants.
              <span className="block text-orange-300">Far too many receipts.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openNewVisit()}
            className="rounded-xl bg-[#f4512c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-950/30 transition hover:-translate-y-0.5 hover:bg-[#dc3f1d] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-stone-950"
          >
            + Write a review
          </button>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total damage" value={money(totalSpent)} />
        <StatCard label="Meals logged" value={String(visits.length)} />
        <StatCard label="Places tried" value={String(reviewedRestaurantCount)} />
        <StatCard
          label="Average receipt"
          value={money(visits.length === 0 ? 0 : totalSpent / visits.length)}
        />
      </section>

      {(notice || error) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`mt-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${
            error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{error ?? notice}</span>
          <button
            type="button"
            className="ml-4 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss message"
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <aside className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f4512c]">
                The hit list
              </p>
              <h3 className="mt-1 text-lg font-black text-stone-900">Restaurants</h3>
            </div>
            <button
              type="button"
              onClick={openNewRestaurant}
              className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800"
            >
              + I want to go!
            </button>
          </div>

          <label className="relative block">
            <span className="sr-only">Search restaurants</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, cuisine, address"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="mt-3 space-y-2">
            {filteredRestaurants.map((restaurant) => {
              const restaurantVisits = visitsFor(restaurant.id);
              const rating = restaurantRating(restaurant);
              const active = selectedRestaurantId === restaurant.id;
              return (
                <button
                  key={restaurant.id}
                  type="button"
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    active
                      ? 'border-orange-300 bg-orange-50 shadow-sm'
                      : 'border-transparent hover:border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-stone-900">
                        {restaurant.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {restaurant.cuisine ?? 'Cuisine TBD'} ·{' '}
                        {restaurant.address ?? 'Address TBD'}
                      </p>
                    </div>
                    {rating !== null && <Stars rating={rating} compact />}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-stone-500">
                    {restaurantVisits.length === 0
                      ? 'I want to go!'
                      : `${restaurantVisits.length} review${
                          restaurantVisits.length === 1 ? '' : 's'
                        } · ${money(
                          restaurantVisits.reduce(
                            (sum, visit) => sum + (visit.amountSpent ?? 0),
                            0
                          )
                        )} spent`}
                  </p>
                </button>
              );
            })}

            {filteredRestaurants.length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
                No restaurants match that search.
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 rounded-2xl border border-orange-100 bg-white shadow-sm">
          {selectedRestaurant ? (
            <>
              <div className="border-b border-stone-100 p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f4512c]">
                      Brennen has thoughts
                    </p>
                    <h3 className="font-brand mt-1 text-2xl font-black tracking-[-0.03em] text-stone-950 sm:text-3xl">
                      {selectedRestaurant.name}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">
                      {selectedRestaurant.cuisine ?? 'Cuisine TBD'} ·{' '}
                      {selectedRestaurant.address ?? 'Address TBD'}
                    </p>
                    {restaurantRating(selectedRestaurant) !== null && (
                      <div className="mt-3">
                        <Stars rating={restaurantRating(selectedRestaurant)!} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNewVisit(selectedRestaurant.id)}
                      className="rounded-lg bg-[#f4512c] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#dc3f1d]"
                    >
                      + Write review
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditRestaurant(selectedRestaurant)}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteRestaurant(selectedRestaurant)}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-black text-stone-900">
                      Brennen&apos;s reviews
                    </h4>
                    <p className="mt-1 text-sm text-stone-500">
                      Every opinion, backed by a receipt.
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">
                    {selectedVisits.length}{' '}
                    {selectedVisits.length === 1 ? 'visit' : 'visits'}
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedVisits.map((visit) => (
                    <article
                      key={visit.id}
                      className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          {visit.rating !== null && <Stars rating={visit.rating} />}
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            {readableDate(visit.date)} ·{' '}
                            {money(visit.amountSpent ?? 0)} spent
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs font-bold">
                          <button
                            type="button"
                            className="text-stone-500 hover:text-orange-700"
                            onClick={() => openEditVisit(visit)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="text-stone-400 hover:text-red-700 disabled:opacity-50"
                            onClick={() => deleteVisit(visit)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                        {visit.notes ?? 'No written review—just the financial evidence.'}
                      </p>
                    </article>
                  ))}

                  {selectedVisits.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 px-5 py-10 text-center">
                      <p className="text-3xl" aria-hidden="true">
                        🍽️
                      </p>
                      <p className="mt-3 font-black text-stone-900">
                        Brennen has not eaten here yet.
                      </p>
                      <p className="mt-1 text-sm text-stone-500">
                        Unusual restraint. Possibly suspicious.
                      </p>
                      <button
                        type="button"
                        onClick={() => openNewVisit(selectedRestaurant.id)}
                        className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-stone-700"
                      >
                        Log the first visit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="grid min-h-[28rem] place-items-center p-8 text-center">
              <div>
                <p className="text-4xl" aria-hidden="true">
                  🥡
                </p>
                <h3 className="mt-3 text-xl font-black text-stone-900">
                  The list is empty.
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Add a restaurant or write a review to begin.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {restaurantModalOpen && (
        <Modal
          title={editingRestaurantId ? 'Edit restaurant' : 'Add a restaurant'}
          subtitle="Give Brennen somewhere new to judge."
          onClose={() => !busy && setRestaurantModalOpen(false)}
        >
          <form onSubmit={saveRestaurant} className="space-y-4">
            <Field label="Restaurant name" required>
              <input
                required
                value={restaurantForm.name}
                onChange={(event) =>
                  setRestaurantForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Brennen's Burrito Barn"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cuisine">
                <input
                  value={restaurantForm.cuisine}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      cuisine: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Mexican"
                />
              </Field>
              <Field label="Overall rating">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={restaurantForm.rating}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      rating: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="4.5"
                />
              </Field>
            </div>
            <Field label="Address">
              <input
                value={restaurantForm.address}
                onChange={(event) =>
                  setRestaurantForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="100 Main St"
              />
            </Field>
            <ModalActions
              busy={busy}
              submitLabel={editingRestaurantId ? 'Save changes' : 'Add restaurant'}
              onCancel={() => setRestaurantModalOpen(false)}
            />
          </form>
        </Modal>
      )}

      {visitModalOpen && (
        <Modal
          title={editingVisitId ? 'Edit review' : 'Write a review'}
          subtitle="The stars are subjective. The receipt is not."
          onClose={() => !busy && setVisitModalOpen(false)}
        >
          <form onSubmit={saveVisit} className="space-y-4">
            {editingVisitId === null && (
              <>
                <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1">
                  {(['existing', 'new'] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() =>
                        setVisitForm((current) => ({
                          ...current,
                          restaurantMode: mode,
                        }))
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                        visitForm.restaurantMode === mode
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      {mode === 'existing' ? 'Existing restaurant' : 'New restaurant'}
                    </button>
                  ))}
                </div>

                {visitForm.restaurantMode === 'existing' ? (
                  <Field label="Restaurant" required>
                    <select
                      required
                      value={visitForm.restaurantId}
                      onChange={(event) =>
                        setVisitForm((current) => ({
                          ...current,
                          restaurantId: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">Choose a restaurant</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div className="space-y-4 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                    <Field label="Restaurant name" required>
                      <input
                        required
                        value={visitForm.newName}
                        onChange={(event) =>
                          setVisitForm((current) => ({
                            ...current,
                            newName: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="A brand-new target"
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Cuisine">
                        <input
                          value={visitForm.newCuisine}
                          onChange={(event) =>
                            setVisitForm((current) => ({
                              ...current,
                              newCuisine: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="Korean"
                        />
                      </Field>
                      <Field label="Address">
                        <input
                          value={visitForm.newAddress}
                          onChange={(event) =>
                            setVisitForm((current) => ({
                              ...current,
                              newAddress: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="42 Dinner Ave"
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Visit date" required>
                <input
                  required
                  type="date"
                  max={localToday()}
                  value={visitForm.date}
                  onChange={(event) =>
                    setVisitForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Amount spent" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                    $
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    value={visitForm.amountSpent}
                    onChange={(event) =>
                      setVisitForm((current) => ({
                        ...current,
                        amountSpent: event.target.value,
                      }))
                    }
                    className={`${inputClass} pl-7`}
                    placeholder="24.50"
                  />
                </div>
              </Field>
            </div>

            <Field label="Brennen's rating" required>
              <StarPicker
                value={visitForm.rating}
                onChange={(rating) =>
                  setVisitForm((current) => ({ ...current, rating }))
                }
              />
            </Field>

            <Field label="The review">
              <textarea
                rows={4}
                maxLength={2000}
                value={visitForm.notes}
                onChange={(event) =>
                  setVisitForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className={`${inputClass} resize-y`}
                placeholder="What happened? What was ordered? Would Brennen return?"
              />
            </Field>

            <ModalActions
              busy={busy}
              submitLabel={editingVisitId ? 'Save review' : 'Publish review'}
              onCancel={() => setVisitModalOpen(false)}
            />
          </form>
        </Modal>
      )}
    </>
  );
}

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white px-4 py-4 shadow-sm sm:px-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black tracking-tight text-stone-900 sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-stone-700">
        {label}
        {required && <span className="ml-1 text-[#f4512c]">*</span>}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-stone-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-6 w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <h2 className="font-brand text-2xl font-black tracking-[-0.03em] text-stone-950">
              {title}
            </h2>
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xl text-stone-500 hover:bg-stone-200 hover:text-stone-900"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  busy,
  submitLabel,
  onCancel,
}: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-stone-100 pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-xl px-4 py-2.5 text-sm font-bold text-stone-500 hover:bg-stone-100 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-[#f4512c] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#dc3f1d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
