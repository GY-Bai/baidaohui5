#!/bin/bash

# 百刀会 MongoDB 备份脚本
# 使用方法: ./mongo-backup.sh [backup|restore] [backup_file]

set -e

# 配置
MONGO_DB=${MONGO_DB:-"baidaohui"}
BACKUP_DIR=${BACKUP_DIR:-"./backups/mongo"}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="baidaohui_atlas_${DATE}.archive"

# 检查MongoDB Atlas URI
if [ -z "$MONGODB_URI" ]; then
    log "错误: 未设置 MONGODB_URI 环境变量"
    log "请设置 MongoDB Atlas 连接字符串"
    exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 备份函数
backup() {
    log "开始备份 MongoDB 数据库: $MONGO_DB"
    
    # 使用mongodump进行备份到Atlas
    mongodump \
        --uri="$MONGODB_URI" \
        --db="$MONGO_DB" \
        --archive="$BACKUP_DIR/$BACKUP_FILE" \
        --gzip \
        --verbose
    
    if [ $? -eq 0 ]; then
        log "备份成功: $BACKUP_DIR/$BACKUP_FILE"
        
        # 计算文件大小
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log "备份文件大小: $SIZE"
        
        # 清理旧备份（保留最近7天）
        find "$BACKUP_DIR" -name "baidaohui_atlas_*.archive" -mtime +7 -delete
        log "已清理7天前的旧备份文件"
        
        # 发送通知（如果配置了Bark）
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "MongoDB备份成功" "文件: $BACKUP_FILE, 大小: $SIZE, 服务器: $(hostname)"
        fi
    else
        log "备份失败"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "MongoDB备份失败" "请检查服务器状态, 服务器: $(hostname)"
        fi
        exit 1
    fi
}

# 恢复函数
restore() {
    local restore_file="$1"
    
    if [ -z "$restore_file" ]; then
        log "错误: 请指定要恢复的备份文件"
        echo "使用方法: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$restore_file" ]; then
        log "错误: 备份文件不存在: $restore_file"
        exit 1
    fi
    
    log "开始恢复 MongoDB 数据库: $MONGO_DB"
    log "备份文件: $restore_file"
    
    # 确认恢复操作
    read -p "确认要恢复数据库吗？这将覆盖现有数据 (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log "恢复操作已取消"
        exit 0
    fi
    
    # 使用mongorestore进行恢复到Atlas
    mongorestore \
        --uri="$MONGODB_URI" \
        --db="$MONGO_DB" \
        --archive="$restore_file" \
        --gzip \
        --drop \
        --verbose
    
    if [ $? -eq 0 ]; then
        log "恢复成功"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "MongoDB恢复成功" "文件: $(basename $restore_file), 服务器: $(hostname)"
        fi
    else
        log "恢复失败"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "MongoDB恢复失败" "请检查备份文件和数据库状态, 服务器: $(hostname)"
        fi
        exit 1
    fi
}

# 发送Bark推送通知
send_bark_notification() {
    local title="$1"
    local message="$2"
    
    if [ -n "$BARK_API_URL" ]; then
        curl -s -X POST "${BARK_API_URL}/${title}/${message}?group=数据库备份&sound=bell" > /dev/null
    fi
}

# 列出备份文件
list_backups() {
    log "可用的备份文件:"
    ls -lh "$BACKUP_DIR"/baidaohui_atlas_*.archive 2>/dev/null || log "没有找到备份文件"
}

# 主函数
main() {
    case "$1" in
        backup)
            backup
            ;;
        restore)
            restore "$2"
            ;;
        list)
            list_backups
            ;;
        *)
            echo "百刀会 MongoDB 备份工具"
            echo ""
            echo "使用方法:"
            echo "  $0 backup                    # 创建备份"
            echo "  $0 restore <backup_file>     # 恢复备份"
            echo "  $0 list                      # 列出备份文件"
            echo ""
            echo "环境变量:"
            echo "  MONGODB_URI    MongoDB Atlas连接字符串 (必需)"
            echo "  MONGO_DB       数据库名称 (默认: baidaohui)"
            echo "  BACKUP_DIR     备份目录 (默认: ./backups/mongo)"
            echo "  BARK_API_URL   Bark推送API地址"
            exit 1
            ;;
    esac
}

main "$@" 