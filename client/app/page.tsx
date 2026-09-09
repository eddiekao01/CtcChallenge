import { RestaurantJournal } from '@/components/RestaurantJournal';
import { getRestaurants, getVisits } from '@/lib/apiClient';

// Server component: load the initial journal over the same HTTP APIs that the
// interactive client uses for later writes.
export default async function HomePage() {
  const [restaurants, visits] = await Promise.all([
    getRestaurants(),
    getVisits(),
  ]);

  return (
    <RestaurantJournal
      initialRestaurants={restaurants}
      initialVisits={visits}
    />
  );
}
