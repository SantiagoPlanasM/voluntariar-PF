import { createBrowserRouter } from 'react-router';
import { Root } from './components/Root';
import { NGOLayout } from './components/NGOLayout';
import { PublicFeed } from './components/PublicFeed';
import { MainFeed } from './components/MainFeed';
import { ProjectDetails } from './components/ProjectDetails';
import { VolunteerProfile } from './components/VolunteerProfile';
import { NGODashboard } from './components/NGODashboard';
import { NGOProjectDetail } from './components/NGOProjectDetail';
import { CreateVoluntariado } from './components/CreateVoluntariado';
import { NGOOwnProfile } from './components/NGOOwnProfile';
import { ExploreScreen } from './components/ExploreScreen';
import { MyParticipation } from './components/MyParticipation';
import { NotificationsScreen } from './components/NotificationsScreen';
import { NGOPublicProfile } from './components/NGOPublicProfile';
import { NGOEmpleados } from './components/NGOEmpleados';
import { NGOKPIs } from './components/NGOKPIs';
import { MessagesScreen } from './components/MessagesScreen';
import { ChatThread } from './components/ChatThread';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true,             Component: PublicFeed },
      { path: 'feed',            Component: MainFeed },
      { path: 'project/:id',     Component: ProjectDetails },
      { path: 'profile',         Component: VolunteerProfile },
      { path: 'explore',         Component: ExploreScreen },
      { path: 'participation',   Component: MyParticipation },
      { path: 'notifications',   Component: NotificationsScreen },
      { path: 'messages',        Component: MessagesScreen },
      { path: 'messages/:userId', Component: ChatThread },
      { path: 'ngo/:id',         Component: NGOPublicProfile },
    ],
  },
  {
    path: '/ngo',
    Component: NGOLayout,
    children: [
      { index: true,                              Component: NGODashboard },
      { path: 'dashboard',                        Component: NGODashboard },
      { path: 'dashboard/project/:projectId',     Component: NGOProjectDetail },
      { path: 'create',                           Component: CreateVoluntariado },
      { path: 'profile',                          Component: NGOOwnProfile },
      { path: 'empleados/:id',                    Component: NGOEmpleados },
      { path: 'kpis/:projectId',                  Component: NGOKPIs },
      { path: 'messages',                         Component: MessagesScreen },
      { path: 'messages/:userId',                 Component: ChatThread },
    ],
  },
]);
