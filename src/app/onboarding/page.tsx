import { redirect } from 'next/navigation';

// Replaced by the /welcome first-run flow.
export default function Onboarding() {
  redirect('/welcome');
}
