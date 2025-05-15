import React from 'react';
import { Provider } from 'react-redux';
import {compose} from 'redux';
import GUI ,{AppStateHOC} from 'scratch-gui';
import store from './store';
// import 'scratch-gui/dist/scratch-gui.css';
import './App.css';

// import storage from './storage';

// 从全局配置中获取参数
const getConfig = () => {
  return window.SCRATCH_CONFIG || {
    canSave: true,
    canRemix: true,
    canCreateNew: true,
    canEditTitle: true,
    enableCommunity: false,
    showComingSoon: true,
    projectHost: "",
    projectId: "",
    basePath: "./",
    assetHost: "",
    host: "http://localhost:8080",
    projectsRoute: "/www/scratch/projects",
    projectTitle: "",

  };
};

const onClickLogo = () => {
  let cfg=getConfig()
  window.location = cfg.projectsRoute;
};


const App = () => {
  // 获取配置
  const config = getConfig();
  const WrappedGui = compose(
    AppStateHOC,
  )(GUI);

  const onUpdateProjectThumbnail = async (projectId, thumbnail) => {
    // 调用后端接口更新项目缩略图
    const response =await fetch(`${config.host}/api/scratch/projects/${projectId}/thumbnail`, {
      method: 'PUT',
      body: thumbnail ,
    });
    if (response.ok) {
      console.log('更新项目缩略图成功');
    } else {
      console.log('更新项目缩略图失败');
    }
  };
  
  return (    
    <Provider store={store}>
      <div className="scratch-editor" style={{ height: '100vh' }}>
        <WrappedGui
          canSave={config.canSave}
          canRemix={config.canRemix}
          canCreateNew={config.canCreateNew}
          canEditTitle={config.canEditTitle}
          enableCommunity={config.enableCommunity}
          showComingSoon={config.showComingSoon}
          projectHost={config.projectHost}
          projectId={config.projectId}
          basePath={config.basePath}
          assetHost={config.assetHost}
          onClickLogo={onClickLogo}
          projectTitle={config.projectTitle}
          onUpdateProjectThumbnail={onUpdateProjectThumbnail}
        />
      </div>      
    </Provider>
  );
};
export default App;