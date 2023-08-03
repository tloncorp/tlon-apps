import { useIsMobile } from '@/logic/useMedia';
import { ViewProps } from '@/types/groups';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import Settings from './Settings';

const pageAnimationVariants = {
  initial: {
    opacity: 0,
    x: '100vw',
  },
  in: {
    opacity: 1,
    x: 0,
  },
  out: {
    opacity: 0,
    x: '-100vw',
  },
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2,
};

export default function SettingsView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? (
          <MobileHeader title="Settings" pathBack="/profile" />
        ) : null
      }
      className="flex-1 h-full px-4 pt-4"
    >
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageAnimationVariants}
        transition={pageTransition}
        className="h-full overflow-y-scroll px-8 pt-8"
      >
        <Settings />
      </motion.div>
    </Layout>
  );
}
