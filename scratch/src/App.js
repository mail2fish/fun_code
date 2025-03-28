import React from 'react';
import { Provider } from 'react-redux';
import GUI from 'scratch-gui';
import store from './store';
// import 'scratch-gui/dist/scratch-gui.css';
import './App.css';

// import storage from './storage';

// 从全局配置中获取参数
const getConfig = () => {
  return window.SCRATCH_CONFIG || {
    canSave: true,
    canCreateNew: true,
    canEditTitle: true,
    enableCommunity: false,
    showComingSoon: false,
    projectHost: "http://localhost:8080/api/scratch/projects",
    projectId: ""
  };
};

const App = () => {
  // 获取配置
  const config = getConfig();
  
  return (
    <Provider store={store}>
      <div className="scratch-editor" style={{ height: '100vh' }}>
        <GUI
          canSave={config.canSave}
          canCreateNew={config.canCreateNew}
          canEditTitle={config.canEditTitle}
          enableCommunity={config.enableCommunity}
          showComingSoon={config.showComingSoon}
          projectHost={config.projectHost}
          projectId={config.projectId}
        />
      </div>      
    </Provider>
  );
};

export default App;