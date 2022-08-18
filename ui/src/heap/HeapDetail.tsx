import React from 'react';
import { useParams, Outlet } from 'react-router';
import useNest from '@/logic/useNest';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import HeapDetailHeader from './HeapDetail/HeapDetailHeader';
import HeapDetailBody from './HeapDetail/HeapDetailBody';

export default function HeapDetail() {
  const groupFlag = useRouteGroup();
  const nest = useNest();
  const {idCurio} = useParams();

  console.log({groupFlag, nest, idCurio});


  if (!idCurio) {
    return <div />;
  }

  return(
    <Layout 
      aside={<Outlet />}
      className='flex-1 bg-gray-50' 
      header={<HeapDetailHeader flag={groupFlag} nest={nest} idCurio={idCurio}  />}
    >
      <HeapDetailBody />
    </Layout>
  );
}