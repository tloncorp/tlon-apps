import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useIsMobile } from '@/logic/useMedia';
import { ViewProps } from '@/types/groups';
import Layout from '../Layout/Layout';
import MobileHeader from '../MobileHeader';
import About from './About';

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

export default function AboutView({ title }: ViewProps) {
  const isMobile = useIsMobile();

  return (
    <Layout
      header={
        isMobile ? <MobileHeader title="About" pathBack="/profile" /> : null
      }
      className="flex-1 px-4"
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
        className="h-screen overflow-y-scroll pt-8"
      >
        <About />
      </motion.div>
    </Layout>
  );
}
