import React, { useEffect, useState, useCallback } from 'react';
import cn from 'classnames';
import { Route, Routes } from 'react-router-dom';
import { PlusIcon, HomeIcon, GearIcon } from '@radix-ui/react-icons';
import Layout from '@/components/Layout/Layout';
import { PostWall, PostThread } from '@/quorum/QuorumViews';
import { ResponseForm, SettingsForm } from '@/quorum/QuorumForms';
import QuorumNav from '@/nav/QuorumNav';
import { AnchorButton } from '@/quorum/QuorumButtons';
import ErrorRedirect from '@/components/ErrorRedirect';
import { useRouteGroup } from '@/state/groups';
import { useRouteBoard } from '@/state/quorum';
import useMedia from '@/logic/useMedia';


export default function QuorumChannel() {
  const groupFlag = useRouteGroup();
  const chFlag = useRouteBoard();

  return (
    <Layout
      className="flex-1 bg-white"
      mainClass="p-4 max-h-full overflow-y-scroll"
      stickyHeader
      header={
        <Routes>
          <Route index
            element={
              <QuorumNav>
                <AnchorButton to="question" title="New Question" children={<PlusIcon/>} />
                <AnchorButton to="settings" title="Settings" children={<GearIcon/>} />
              </QuorumNav>
            }
          />
          <Route path="search/:query/:page?"
            element={
              <QuorumNav>
                <AnchorButton to="." title="Go to Board" children={<HomeIcon/>} />
              </QuorumNav>
            }
          />
        </Routes>
      }
    >
      <Routes>
        <Route index element={<PostWall />} />
        <Route path="search/:query/:page?" element={<PostWall />} />
        <Route path="question" element={<ResponseForm />} />
        <Route path="settings" element={<SettingsForm />} />
        <Route path="thread/:thread">
          <Route index element={<PostThread />} />
          <Route path="response/:response?" element={<ResponseForm />} />
        </Route>
        <Route path="*" element={
          <ErrorRedirect anchor
            header="Invalid Page!"
            content="Click the logo above to return to safety."
          />
        } />
      </Routes>
    </Layout>
  );
}
