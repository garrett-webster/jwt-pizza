import React from 'react';
import { useLocation } from 'react-router-dom';
import { pizzaService } from '../service/service';
import View from './view';
import Button from '../components/button';
import { useBreadcrumb } from '../hooks/appNavigation';

export default function DeleteUser() {
  const state = useLocation().state;
  const navigateToParentPath = useBreadcrumb();
  const [error, setError] = React.useState<string | null>(null);

  async function deleteUser() {
    try {
      await pizzaService.deleteUser(state.user);
      navigateToParentPath();
    } catch (e: any) {
      setError(e.message ?? 'Unable to delete user');
    }
  }

  return (
    <View title="Delete user">
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-neutral-100">
          Are you sure you want to delete <span className="text-orange-500">{state.user.name}</span> ({state.user.email})? This removes their account and cannot be undone.
        </div>
        {error && <div className="text-red-400 my-2">{error}</div>}
        <Button title="Delete" onPress={deleteUser} />
        <Button title="Cancel" onPress={navigateToParentPath} className="bg-transparent border-neutral-300" />
      </div>
    </View>
  );
}
