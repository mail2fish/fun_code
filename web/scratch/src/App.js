import React from 'react';
import {compose} from 'redux';
import GUI ,{AppStateHOC} from 'scratch-gui';
// import 'scratch-gui/dist/scratch-gui.css';
import './App.css';

// import storage from './storage';

// session reducer - 参考 render-gui.jsx 的实现
const sessionReducer = (state = {
    session: {
        user: {
            username: '',
            nickname: '',
            token: '',
            classroomId: '',
            thumbnailUrl: null
        }
    },
    permissions: {
        educator: false,
        student: false
    }
}, action) => {
    switch (action.type) {
        case 'SET_SESSION_USER':
            return {
                ...state,
                session: {
                    ...state.session,
                    user: {
                        ...state.session.user,
                        ...action.payload
                    }
                }
            };
        case 'SET_SESSION_PERMISSIONS':
            return {
                ...state,
                permissions: {
                    ...state.permissions,
                    ...action.payload
                }
            };
        default:
            return state;
    }
};

// 创建带 session 的 AppStateHOC - 参考 render-gui.jsx 的实现
const AppStateHOCWithSession = (WrappedComponent) => {
    const AppStateWithSession = AppStateHOC(
        WrappedComponent,
        false, // 不是 localesOnly
        { session: sessionReducer }, // 额外的 reducers
        { session: undefined } // 额外的初始状态
    );
    
    // 简单包装，添加调试功能
    class SessionWrapper extends React.Component {
        componentDidMount() {
            // 从配置中获取用户信息并设置到 session
            const config = getConfig();
            
            // AppStateHOC 已经暴露了 store，直接添加调试功能
            setTimeout(() => {
                if (window._reduxStore) {
                    // 设置初始用户信息
                    if (config.username || config.nickname) {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_USER',
                            payload: { 
                                username: config.username || 'Guest',
                                nickname: config.nickname || '',
                                token: (config.username || config.nickname) ? 'session-token' : ''
                            }
                        });
                        
                        console.log('👤 用户信息已初始化:', {
                            username: config.username || 'Guest',
                            nickname: config.nickname || ''
                        });
                    }
                    
                    // 添加调试函数
                    window.switchUser = (username) => {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_USER',
                            payload: { username }
                        });
                    };
                    
                    window.setUserPermissions = (permissions) => {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_PERMISSIONS',
                            payload: permissions
                        });
                    };
                    
                    console.log('🎮 Session state 已注入! 试试: window.switchUser("Alice") 或 window.setUserPermissions({educator: true})');
                }
            }, 100);
        }
        
        render() {
            return <AppStateWithSession {...this.props} />;
        }
    }
    
    return SessionWrapper;
};

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
    username: "",
    nickname: "",
  };
};

const onClickLogo = () => {
  let cfg=getConfig()
  window.location = cfg.projectsRoute;
};


const App = () => {
  // 获取配置
  const config = getConfig();
  
  // 使用带 session 的 AppStateHOC - 参考 render-gui.jsx 的方式
  const WrappedGui = compose(
    AppStateHOCWithSession,
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

  // 添加 renderLogin 函数
  const renderLogin = (props) => {
    return (
      <div className="login-container">
        <button 
          onClick={() => {
            // 可以跳转到登录页面或显示登录模态框
            window.location.href = config.projectsRoute;
          }}
          className="login-button"
        >
          登录
        </button>
      </div>
    );
  };
  
  return (    
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
        renderLogin={renderLogin}
        myStuffUrl={`${config.projectsRoute}`}
      />
    </div>      
  );
};
export default App;