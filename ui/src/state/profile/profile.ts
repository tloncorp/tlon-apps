import { useMemo } from 'react';
import useReactQueryScry from '@/logic/useReactQueryScry';
import { useMutation } from '@tanstack/react-query';
import _ from 'lodash';
import queryClient from '@/queryClient';
import api from '@/api';
import { ProfLayout, ProfWidgets, Widget, getWidgetIdParts } from './types';
import ProfileKeys from './keys';

// stub since we cant get this in the api?
export function useProfileIsPublic(): boolean {
  const { data } = useReactQueryScry<boolean>({
    queryKey: ProfileKeys.bound(),
    app: 'profile',
    path: '/bound/json',
    options: { refetchOnMount: true },
  });

  if (!data) {
    return queryClient.getQueryData(ProfileKeys.bound()) || false;
  }

  return data;
}

function useAvailableWidgets(): ProfWidgets {
  const { data } = useReactQueryScry<ProfWidgets>({
    queryKey: ProfileKeys.widgets(),
    app: 'profile',
    path: '/widgets/json',
    options: { refetchOnMount: true },
  });

  if (!data) {
    return queryClient.getQueryData(ProfileKeys.widgets()) || {};
  }

  return data;
}

export function refreshAvailableWidgets() {
  const hasStaleData = !!queryClient.getQueriesData(ProfileKeys.widgets());
  const notAlreadyFetching = !queryClient.isFetching(ProfileKeys.widgets());

  if (hasStaleData && notAlreadyFetching) {
    queryClient.invalidateQueries(ProfileKeys.widgets());
  }
}

function useVisibleWidgetIds(): ProfLayout {
  const { data } = useReactQueryScry<ProfLayout>({
    queryKey: ProfileKeys.layout(),
    app: 'profile',
    path: '/layout/json',
  });

  if (!data) {
    return queryClient.getQueryData(ProfileKeys.layout()) || [];
  }

  return data;
}

export default function useWidgets(): Widget[] {
  const available = useAvailableWidgets();
  const visible = useVisibleWidgetIds();

  const visibleIds = useMemo(
    () => new Set(visible.map((w) => `${w.desk}:${w.term}`)),
    [visible]
  );
  const widgets = useMemo(() => {
    const wid: Widget[] = [];
    Object.entries(available).forEach(([desk, deskWidgets]) => {
      Object.entries(deskWidgets).forEach(([term, description]) => {
        const id = `${desk}:${term}`;
        wid.push({
          id: `${desk}:${term}`,
          name: description,
          sourceApp: desk,
          visible: visibleIds.has(id),
        });
      });
    });
    //  make sure the profile widget is at the top,
    //  and that groups widgets show above others,
    //  and that the rest is sorted alphabetically.
    wid.sort((a: Widget, b: Widget) => {
      if (a.id === 'groups:profile') return -1;
      if (b.id === 'groups:profile') return 1;
      if (a.sourceApp === 'groups') return -1;
      if (b.sourceApp === 'groups') return 1;
      return a.id.localeCompare(b.id);
    });
    return wid;
  }, [available, visibleIds]);

  return widgets;
}

export function useHideWidgetMutation() {
  const visible = useVisibleWidgetIds();

  const mutationFn = async (variables: { id: string }) => {
    const { desk, term } = getWidgetIdParts(variables.id);

    await api.poke({
      app: 'profile',
      mark: 'json',
      json: {
        'del-widget': {
          desk,
          term,
        },
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(ProfileKeys.layout());

      // update cache
      const { desk, term } = getWidgetIdParts(variables.id);
      const newVisible = visible.filter(
        (w) => !(w.desk === desk && w.term === term)
      );
      queryClient.setQueryData(ProfileKeys.layout(), newVisible);
    },
    onSettled: () => {
      queryClient.invalidateQueries(ProfileKeys.layout());
    },
  });
}

export function useShowWidgetMutation() {
  const visible = useVisibleWidgetIds();

  const mutationFn = async (variables: { id: string }) => {
    const { desk, term } = getWidgetIdParts(variables.id);

    await api.poke({
      app: 'profile',
      mark: 'json',
      json: {
        'put-widget': {
          desk,
          term,
        },
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(ProfileKeys.layout());

      // update cache
      const { desk, term } = getWidgetIdParts(variables.id);
      const newVisible = _.cloneDeep(visible);
      if (!newVisible.some((w) => w.desk === desk && w.term === term)) {
        newVisible.push({ desk, term });
      }

      queryClient.setQueryData(ProfileKeys.layout(), newVisible);
    },
    onSettled: () => {
      queryClient.invalidateQueries(ProfileKeys.layout());
    },
  });
}

export function useMakeProfilePublicMutation() {
  const mutationFn = async () => {
    api.poke({
      app: 'profile',
      mark: 'json',
      json: {
        bind: null,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries(ProfileKeys.layout());

      // update cache
      queryClient.setQueriesData(ProfileKeys.bound(), true);
    },
  });
}

export function useMakeProfilePrivateMutation() {
  const mutationFn = async () => {
    await api.poke({
      app: 'profile',
      mark: 'json',
      json: {
        unbind: null,
      },
    });
  };

  return useMutation({
    mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries(ProfileKeys.layout());

      // update cache
      queryClient.setQueriesData(ProfileKeys.bound(), false);
    },
  });
}
