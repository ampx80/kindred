// The global engagement overlay. Every celebratory and re-engagement surface
// lives here so it can appear on any screen: level-up, achievement unlocks, the
// daily reward, the weekly recap, the first-win onboarding moment, the streak
// guard, the session combo meter, the floating quest peek, and the momentum
// meter. Each child subscribes to the game engine itself (onGameMoment / useGame)
// and manages its own visibility, so this host just renders them.
import LevelUpModal from './LevelUpModal.jsx';
import AchievementToast from './AchievementToast.jsx';
import DailyReward from './DailyReward.jsx';
import WeeklyRecap from './WeeklyRecap.jsx';
import FirstWin from './FirstWin.jsx';
import StreakGuard from './StreakGuard.jsx';
import ComboMeter from './ComboMeter.jsx';
import QuestPeek from './QuestPeek.jsx';
import MomentumMeter from './MomentumMeter.jsx';
import SparkReveal from './SparkReveal.jsx';
import ShareCard from './ShareCard.jsx';

export default function GameLayer() {
  return (
    <>
      <LevelUpModal />
      <AchievementToast />
      <DailyReward />
      <WeeklyRecap />
      <FirstWin />
      <StreakGuard />
      <ComboMeter />
      <QuestPeek />
      <MomentumMeter />
      <SparkReveal />
      <ShareCard />
    </>
  );
}
