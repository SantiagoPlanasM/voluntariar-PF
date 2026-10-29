import { createBrowserRouter } from 'react-router';
import { Root } from './components/Root';
import { NGOLayout } from './components/NGOLayout';
import { CompanyLayout } from './components/CompanyLayout';
import { PublicFeed } from './components/PublicFeed';
import { MainFeed } from './components/MainFeed';
import { ProjectDetails } from './components/ProjectDetails';
import { VolunteerProfile } from './components/VolunteerProfile';
import { VolunteerPublicProfile } from './components/VolunteerPublicProfile';
import { DonationReturn } from './components/DonationReturn';
import { DeleteAccountPage } from './components/DeleteAccountPage';
import { PrivacyPage } from './components/PrivacyPage';
import { NGODashboard } from './components/NGODashboard';
import { NGOProjectDetail } from './components/NGOProjectDetail';
import { CreateVoluntariado } from './components/CreateVoluntariado';
import { NGOOwnProfile } from './components/NGOOwnProfile';
import { MercadoPagoReturn } from './components/MercadoPagoReturn';
import { NGOPatrocinios } from './components/NGOPatrocinios';
import { SponsorshipAgreementScreen } from './components/SponsorshipAgreementScreen';
import { CompanyOwnProfile } from './components/CompanyOwnProfile';
import { CompanyDashboard } from './components/CompanyDashboard';
import { CompanyPublicProfile } from './components/CompanyPublicProfile';
import { ExploreScreen } from './components/ExploreScreen';
import { MyParticipation } from './components/MyParticipation';
import { CertificatePage } from './components/CertificatePage';
import { NotificationsScreen } from './components/NotificationsScreen';
import { NGOPublicProfile } from './components/NGOPublicProfile';
import { NGOEmpleados } from './components/NGOEmpleados';
import { NGOKPIs } from './components/NGOKPIs';
import { MessagesScreen } from './components/MessagesScreen';
import { ChatThread } from './components/ChatThread';
import { AssistantScreen } from './components/AssistantScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { MomentsPage } from './components/MomentsPage';
import { NGOMoments } from './components/NGOMoments';
import { NotFoundPage } from './components/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true,             Component: PublicFeed },
      { path: 'feed',            Component: MainFeed },
      { path: 'project/:id',     Component: ProjectDetails },
      { path: 'projects/:id',    Component: ProjectDetails },
      { path: 'profile',         Component: VolunteerProfile },
      { path: 'explore',         Component: ExploreScreen },
      { path: 'participation',   Component: MyParticipation },
      { path: 'certificado/:enrollmentId', Component: CertificatePage }, // certificado de participación (§269)
      { path: 'notifications',   Component: NotificationsScreen },
      { path: 'momentos',        Component: MomentsPage },
      { path: 'messages',        Component: MessagesScreen },
      { path: 'messages/asistente', Component: AssistantScreen },
      { path: 'messages/:userId', Component: ChatThread },
      { path: 'ngo/:id',         Component: NGOPublicProfile },
      { path: 'company/:id',     Component: CompanyPublicProfile },
      { path: 'volunteer/:id',   Component: VolunteerPublicProfile },
      { path: 'donaciones/vuelta', Component: DonationReturn },   // vuelta desde Mercado Pago (§172)
      { path: 'cuenta/borrar',   Component: DeleteAccountPage },   // link del email para borrar la cuenta (§178)
      { path: 'privacidad',      Component: PrivacyPage },            // privacidad y términos (§179)
      { path: 'settings',        Component: SettingsScreen },         // configuración: CV, tema, cerrar sesión, borrar cuenta (§240)
      { path: '*',               Component: NotFoundPage },           // URL que no existe: antes, la pantalla de desarrollador de React Router (D28, §247)
    ],
  },
  {
    path: '/ngo',
    Component: NGOLayout,
    children: [
      { index: true,                              Component: NGODashboard },
      { path: 'dashboard',                        Component: NGODashboard },
      { path: 'dashboard/project/:projectId',     Component: NGOProjectDetail },
      { path: 'dashboard/project/:projectId/editar', Component: CreateVoluntariado }, // editar un voluntariado (§255)
      { path: 'create',                           Component: CreateVoluntariado },
      { path: 'profile',                          Component: NGOOwnProfile },
      // §218: vuelta de Mercado Pago al vincular la cuenta (MP_OAUTH_REDIRECT_URI = <APP_URL>/ngo/mercadopago/vuelta).
      { path: 'mercadopago/vuelta',               Component: MercadoPagoReturn },
      { path: 'patrocinios',                      Component: NGOPatrocinios },
      { path: 'patrocinios/:empresaId/:projectId', Component: SponsorshipAgreementScreen }, // el acuerdo (§265)
      { path: 'momentos',                         Component: NGOMoments },
      { path: 'empleados/:id',                    Component: NGOEmpleados },
      { path: 'kpis/:projectId',                  Component: NGOKPIs },
      { path: 'messages',                         Component: MessagesScreen },
      { path: 'messages/asistente',               Component: AssistantScreen },
      { path: 'messages/:userId',                 Component: ChatThread },
      // §173: antes la ONG no tenía dónde ver sus notificaciones (solo existía /notifications, del voluntario).
      { path: 'notifications',                    element: <NotificationsScreen inPanel /> },
    ],
  },
  {
    path: '/company',
    Component: CompanyLayout,
    children: [
      { index: true,               Component: CompanyOwnProfile },
      { path: 'dashboard',         Component: CompanyDashboard },
      { path: 'patrocinios/:empresaId/:projectId', Component: SponsorshipAgreementScreen }, // el acuerdo (§265)
      { path: 'profile',           Component: CompanyOwnProfile },
      { path: 'messages',          Component: MessagesScreen },
      { path: 'messages/asistente', Component: AssistantScreen },
      { path: 'messages/:userId',  Component: ChatThread },
    ],
  },
]);

